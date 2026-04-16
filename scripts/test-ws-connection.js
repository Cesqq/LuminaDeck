/**
 * LuminaDeck Companion - WebSocket Connection Test
 *
 * Manual testing script that connects to the local companion app's
 * TLS WebSocket server and exercises the ping + keybind execute protocol.
 *
 * Uses Node.js built-in WebSocket API (Node >= 22). No npm packages needed.
 *
 * Usage:
 *   node scripts/test-ws-connection.js
 *
 * Prerequisites:
 *   - The companion binary must be running (src-tauri/target/debug/luminadeck-companion.exe)
 *   - The server listens on wss://localhost:9876 with a self-signed cert
 */

// Accept self-signed certificates for the entire process
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SERVER_URL = "wss://localhost:9876";

function ts() {
  return new Date().toISOString();
}

function log(label, data) {
  console.log(`[${ts()}] ${label}:`, JSON.stringify(data, null, 2));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`\n=== LuminaDeck WS Connection Test ===`);
  console.log(`Connecting to ${SERVER_URL} ...\n`);

  const ws = new WebSocket(SERVER_URL);

  // Queue-based response collector
  const responses = [];
  let resolveNext = null;

  function waitForResponse(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      if (responses.length > 0) {
        resolve(responses.shift());
        return;
      }
      const timer = setTimeout(() => {
        resolveNext = null;
        reject(new Error("Timed out waiting for server response"));
      }, timeoutMs);
      resolveNext = (data) => {
        clearTimeout(timer);
        resolve(data);
      };
    });
  }

  ws.addEventListener("message", (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      data = { raw: event.data };
    }
    if (resolveNext) {
      const cb = resolveNext;
      resolveNext = null;
      cb(data);
    } else {
      responses.push(data);
    }
  });

  ws.addEventListener("error", (event) => {
    console.error(`[${ts()}] WebSocket error:`, event.message || event.type);
  });

  // Wait for connection
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", (e) => reject(new Error(e.message || "Connection failed")), { once: true });
  });

  console.log(`[${ts()}] Connected!\n`);

  // ── Test 1: Ping ──────────────────────────────────────────────────
  console.log("--- Test 1: Ping ---");
  const pingMsg = {
    type: "ping",
    timestamp: Date.now(),
  };
  log("SEND", pingMsg);
  ws.send(JSON.stringify(pingMsg));

  try {
    const pongResp = await waitForResponse();
    log("RECV", pongResp);

    if (pongResp.type === "pong") {
      const rtt = Date.now() - pingMsg.timestamp;
      console.log(`  -> Pong received. Round-trip: ${rtt}ms`);
      console.log(`  -> Server time: ${pongResp.serverTime}\n`);
    } else {
      console.log("  -> Unexpected response type\n");
    }
  } catch (e) {
    console.error("  -> " + e.message + "\n");
  }

  await sleep(200);

  // ── Test 2: Execute keybind (Ctrl+C) ──────────────────────────────
  console.log("--- Test 2: Execute keybind [ctrl, c] ---");
  const execMsg = {
    type: "execute",
    id: "test-keybind-1",
    action: {
      type: "keybind",
      keys: ["ctrl", "c"],
    },
  };
  log("SEND", execMsg);
  ws.send(JSON.stringify(execMsg));

  try {
    const execResp = await waitForResponse();
    log("RECV", execResp);

    if (execResp.type === "execute_result") {
      console.log(
        `  -> Success: ${execResp.success}${execResp.error ? " | Error: " + execResp.error : ""}\n`
      );
    } else {
      console.log("  -> Unexpected response type\n");
    }
  } catch (e) {
    console.error("  -> " + e.message + "\n");
  }

  await sleep(200);

  // ── Test 3: Execute system action (volume_up) ─────────────────────
  console.log("--- Test 3: Execute system action (volume_up) ---");
  const sysMsg = {
    type: "execute",
    id: "test-system-1",
    action: {
      type: "system_action",
      action: "volume_up",
    },
  };
  log("SEND", sysMsg);
  ws.send(JSON.stringify(sysMsg));

  try {
    const sysResp = await waitForResponse();
    log("RECV", sysResp);

    if (sysResp.type === "execute_result") {
      console.log(
        `  -> Success: ${sysResp.success}${sysResp.error ? " | Error: " + sysResp.error : ""}\n`
      );
    } else {
      console.log("  -> Unexpected response type\n");
    }
  } catch (e) {
    console.error("  -> " + e.message + "\n");
  }

  // ── Cleanup ───────────────────────────────────────────────────────
  console.log("--- Closing connection ---");
  ws.close();
  console.log(`[${ts()}] Done.\n`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
