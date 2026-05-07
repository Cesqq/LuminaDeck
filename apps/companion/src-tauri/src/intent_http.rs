//! Minimal HTTP/1.1 listener for the `/intent-execute` endpoint used by
//! the iOS Widget + Apple Watch surfaces. Hand-rolled (no axum/hyper) so
//! the binary stays small — there is exactly one route, one method, and
//! the parser only needs to handle requests <16 KB.
//!
//! Auth + dispatch contract lives in [`crate::intent_endpoint`]. This
//! file is just the HTTP transport on top of it.
//!
//! Request shape:
//! ```text
//! POST /intent-execute HTTP/1.1
//! Host: <ip>:9878
//! Content-Type: application/json
//! Content-Length: <n>
//! X-LuminaDeck-Timestamp: <ms-since-epoch>
//! X-LuminaDeck-Signature: <hex hmac-sha256>
//!
//! {"deviceId":"...","buttonId":"slot-0","action":{"type":"system_action","action":"volume_up"}}
//! ```
//!
//! Response: `200 OK` on dispatch success, `401 Unauthorized` on HMAC
//! failure, `400 Bad Request` on parse failure, `503 Service Unavailable`
//! on keyring failure. Bodies are short ASCII strings so the widget can
//! log meaningful errors without parsing JSON.

use crate::actions::{self, Action};
use crate::intent_endpoint::{self, IntentError};

use std::io::ErrorKind;
use std::net::SocketAddr;
use std::time::{SystemTime, UNIX_EPOCH};

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const PORT: u16 = 9878;
const MAX_BODY: usize = 16 * 1024;
const READ_TIMEOUT_MS: u64 = 5_000;

#[derive(serde::Deserialize)]
struct IntentBody {
    #[serde(rename = "deviceId")]
    device_id: String,
    #[serde(rename = "buttonId")]
    #[allow(dead_code)]
    button_id: String,
    action: Action,
}

/// Spawn the listener as a background task. Errors during bind are
/// logged but don't take down the companion — the widget endpoint is a
/// nice-to-have, not load-bearing for the WS path.
///
/// Uses `tauri::async_runtime::spawn` (not `tokio::spawn`) because this is
/// called from Tauri's setup hook, which runs on a thread that doesn't have
/// a Tokio runtime in TLS. `tauri::async_runtime` resolves to whatever async
/// runtime Tauri picked at startup (tokio under the hood), but its `spawn`
/// is safe to call from any thread.
pub fn spawn() {
    tauri::async_runtime::spawn(async move {
        if let Err(e) = run().await {
            log::error!("intent HTTP listener exited: {e}");
        }
    });
}

async fn run() -> std::io::Result<()> {
    let addr = SocketAddr::from(([0, 0, 0, 0], PORT));
    let listener = TcpListener::bind(addr).await?;
    log::info!("Intent HTTP listener bound to http://0.0.0.0:{PORT}");

    loop {
        let (stream, peer) = listener.accept().await?;
        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, peer).await {
                log::debug!("intent http {peer}: {e}");
            }
        });
    }
}

async fn handle_connection(
    mut stream: tokio::net::TcpStream,
    peer: SocketAddr,
) -> std::io::Result<()> {
    let timeout = std::time::Duration::from_millis(READ_TIMEOUT_MS);

    let raw = match tokio::time::timeout(timeout, read_request(&mut stream)).await {
        Ok(Ok(r)) => r,
        Ok(Err(e)) => {
            write_status(&mut stream, 400, "bad request").await.ok();
            return Err(e);
        }
        Err(_) => {
            write_status(&mut stream, 408, "timeout").await.ok();
            return Err(std::io::Error::new(ErrorKind::TimedOut, "read timeout"));
        }
    };

    match dispatch(&raw).await {
        Ok(()) => write_status(&mut stream, 200, "ok").await,
        Err(DispatchError::BadRequest(reason)) => {
            log::warn!("intent http {peer}: bad request: {reason}");
            write_status(&mut stream, 400, &reason).await
        }
        Err(DispatchError::Unauthorized(reason)) => {
            log::warn!("intent http {peer}: unauthorized: {reason}");
            write_status(&mut stream, 401, "unauthorized").await
        }
        Err(DispatchError::Unavailable(reason)) => {
            log::error!("intent http {peer}: unavailable: {reason}");
            write_status(&mut stream, 503, "unavailable").await
        }
    }
}

#[derive(Debug)]
enum DispatchError {
    BadRequest(String),
    Unauthorized(String),
    Unavailable(String),
}

impl From<IntentError> for DispatchError {
    fn from(e: IntentError) -> Self {
        match e {
            IntentError::TimestampOutOfRange => Self::Unauthorized("ts".into()),
            IntentError::MalformedSignature => Self::Unauthorized("sig".into()),
            IntentError::SignatureMismatch => Self::Unauthorized("sig".into()),
            IntentError::KeyringUnavailable(s) => Self::Unavailable(s),
        }
    }
}

struct RawRequest {
    method: String,
    path: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

async fn read_request(stream: &mut tokio::net::TcpStream) -> std::io::Result<RawRequest> {
    let mut buf = Vec::with_capacity(2048);
    let mut tmp = [0u8; 1024];

    // Read until we see the end-of-headers marker `\r\n\r\n`.
    let header_end = loop {
        let n = stream.read(&mut tmp).await?;
        if n == 0 {
            return Err(std::io::Error::new(
                ErrorKind::UnexpectedEof,
                "peer closed before headers complete",
            ));
        }
        buf.extend_from_slice(&tmp[..n]);
        if let Some(idx) = find_header_end(&buf) {
            break idx;
        }
        if buf.len() > MAX_BODY + 2048 {
            return Err(std::io::Error::new(ErrorKind::InvalidData, "headers too large"));
        }
    };

    let header_bytes = &buf[..header_end];
    let header_str = std::str::from_utf8(header_bytes)
        .map_err(|_| std::io::Error::new(ErrorKind::InvalidData, "non-utf8 headers"))?;

    let mut lines = header_str.split("\r\n");
    let request_line = lines
        .next()
        .ok_or_else(|| std::io::Error::new(ErrorKind::InvalidData, "no request line"))?;
    let mut parts = request_line.split_whitespace();
    let method = parts
        .next()
        .ok_or_else(|| std::io::Error::new(ErrorKind::InvalidData, "no method"))?
        .to_string();
    let path = parts
        .next()
        .ok_or_else(|| std::io::Error::new(ErrorKind::InvalidData, "no path"))?
        .to_string();

    let mut headers: Vec<(String, String)> = Vec::new();
    for line in lines {
        if line.is_empty() {
            continue;
        }
        if let Some((k, v)) = line.split_once(':') {
            headers.push((k.trim().to_ascii_lowercase(), v.trim().to_string()));
        }
    }

    let content_length: usize = headers
        .iter()
        .find(|(k, _)| k == "content-length")
        .and_then(|(_, v)| v.parse().ok())
        .unwrap_or(0);

    if content_length > MAX_BODY {
        return Err(std::io::Error::new(ErrorKind::InvalidData, "body too large"));
    }

    let body_start = header_end + 4; // skip the \r\n\r\n
    let already_have = buf.len().saturating_sub(body_start);
    let mut body = buf.split_off(body_start);
    body.truncate(already_have);

    while body.len() < content_length {
        let want = content_length - body.len();
        let mut chunk = vec![0u8; want.min(1024)];
        let n = stream.read(&mut chunk).await?;
        if n == 0 {
            return Err(std::io::Error::new(
                ErrorKind::UnexpectedEof,
                "peer closed before body complete",
            ));
        }
        body.extend_from_slice(&chunk[..n]);
    }

    Ok(RawRequest {
        method,
        path,
        headers,
        body,
    })
}

fn find_header_end(buf: &[u8]) -> Option<usize> {
    buf.windows(4).position(|w| w == b"\r\n\r\n")
}

async fn dispatch(req: &RawRequest) -> Result<(), DispatchError> {
    if req.method != "POST" {
        return Err(DispatchError::BadRequest("method".into()));
    }
    if req.path != "/intent-execute" {
        return Err(DispatchError::BadRequest("path".into()));
    }

    let ts_str = header(req, "x-luminadeck-timestamp")
        .ok_or_else(|| DispatchError::BadRequest("missing timestamp".into()))?;
    let ts_ms: u64 = ts_str
        .parse()
        .map_err(|_| DispatchError::BadRequest("bad timestamp".into()))?;
    let sig = header(req, "x-luminadeck-signature")
        .ok_or_else(|| DispatchError::BadRequest("missing signature".into()))?;

    let body: IntentBody = serde_json::from_slice(&req.body)
        .map_err(|e| DispatchError::BadRequest(format!("bad body: {e}")))?;

    let pair_key = intent_endpoint::get_or_create_pair_key(&body.device_id)?;
    let now = now_ms();
    intent_endpoint::verify_request(&pair_key, ts_ms, &req.body, sig, now)?;

    actions::execute_action(&body.action)
        .await
        .map_err(|e| DispatchError::BadRequest(format!("dispatch: {e}")))?;

    log::info!(
        "Intent dispatched for device={} button={}",
        body.device_id, body.button_id
    );
    Ok(())
}

fn header<'a>(req: &'a RawRequest, name: &str) -> Option<&'a str> {
    req.headers
        .iter()
        .find(|(k, _)| k == name)
        .map(|(_, v)| v.as_str())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

async fn write_status(
    stream: &mut tokio::net::TcpStream,
    code: u16,
    reason: &str,
) -> std::io::Result<()> {
    let body = reason.as_bytes();
    let response = format!(
        "HTTP/1.1 {code} {reason}\r\nContent-Length: {}\r\nContent-Type: text/plain; charset=utf-8\r\nConnection: close\r\n\r\n",
        body.len(),
    );
    stream.write_all(response.as_bytes()).await?;
    stream.write_all(body).await?;
    stream.flush().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_header_end_at_classic_position() {
        // The \r\n\r\n sequence starts at the \r that ends the last header
        // line (here: end of "Host: x\r\n", followed by the empty "\r\n").
        let buf = b"GET / HTTP/1.1\r\nHost: x\r\n\r\nbody";
        let idx = find_header_end(buf).expect("should find terminator");
        assert_eq!(&buf[idx..idx + 4], b"\r\n\r\n");
        assert_eq!(&buf[idx + 4..], b"body");
    }

    #[test]
    fn finds_header_end_with_no_body() {
        let buf = b"GET / HTTP/1.1\r\n\r\n";
        let idx = find_header_end(buf).expect("should find terminator");
        assert_eq!(&buf[idx..idx + 4], b"\r\n\r\n");
        assert_eq!(idx + 4, buf.len());
    }

    #[test]
    fn returns_none_when_no_terminator() {
        let buf = b"POST /foo HTTP/1.1\r\nHost: x\r\n";
        assert_eq!(find_header_end(buf), None);
    }
}
