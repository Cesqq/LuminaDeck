//! Text input action — types arbitrary text via SendInput with Unicode support.
//!
//! Uses KEYEVENTF_UNICODE to handle any character, including non-ASCII.

#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE,
};

/// Type a string character-by-character using SendInput with KEYEVENTF_UNICODE.
/// Handles Unicode characters that cannot be mapped to virtual key codes.
#[cfg(windows)]
pub fn execute_text_input(text: &str) -> Result<(), String> {
    if text.is_empty() {
        return Err("Text input is empty".to_string());
    }

    if text.len() > 4096 {
        return Err("Text input exceeds 4096 character limit".to_string());
    }

    let mut inputs: Vec<INPUT> = Vec::with_capacity(text.len() * 2);

    for ch in text.encode_utf16() {
        // Key down
        inputs.push(INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY(0),
                    wScan: ch,
                    dwFlags: KEYEVENTF_UNICODE,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });

        // Key up
        inputs.push(INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY(0),
                    wScan: ch,
                    dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });
    }

    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };

    if sent == 0 {
        return Err("SendInput failed for text input".to_string());
    }

    log::info!("Typed {} characters via SendInput", text.chars().count());
    Ok(())
}

#[cfg(not(windows))]
pub fn execute_text_input(_text: &str) -> Result<(), String> {
    Err("Text input is only supported on Windows".to_string())
}
