//! Mouse / trackpad action (v1.4.0+ protocol).
//!
//! Mouse events arrive via four message types — `mouse_move`, `mouse_click`,
//! `mouse_scroll`, `mouse_drag` — outside the standard `execute` envelope
//! because they are high-frequency (~60Hz from a moving cursor) and don't
//! benefit from per-event ack overhead.
//!
//! All deltas are RELATIVE in pixels. The phone applies sensitivity before
//! sending; the companion just trusts the delta and submits SendInput.

use super::ActionError;

#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::*;

/// Move the cursor by a relative pixel offset.
///
/// `lock_primary` (v1.2.1) clamps the resulting cursor position to the
/// primary monitor bounds — useful in multi-monitor setups where a
/// trackpad gesture might otherwise dump the cursor onto a secondary
/// screen the user can't see from their phone.
pub fn move_relative(dx: i32, dy: i32, lock_primary: bool) -> Result<(), ActionError> {
    #[cfg(windows)]
    {
        let mi = MOUSEINPUT {
            dx,
            dy,
            mouseData: 0,
            dwFlags: MOUSEEVENTF_MOVE,
            time: 0,
            dwExtraInfo: 0,
        };
        send_mouse_input(mi)?;

        if lock_primary {
            // Re-read cursor position and clamp to the primary monitor.
            // We use SetCursorPos rather than another SendInput because we
            // already moved relatively; an absolute correction here is the
            // simpler, more reliable way to enforce the clamp.
            use windows::Win32::Foundation::POINT;
            use windows::Win32::UI::WindowsAndMessaging::{
                GetCursorPos, SetCursorPos, GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN,
            };
            let mut pt = POINT { x: 0, y: 0 };
            unsafe {
                if GetCursorPos(&mut pt).is_ok() {
                    let max_x = GetSystemMetrics(SM_CXSCREEN) - 1;
                    let max_y = GetSystemMetrics(SM_CYSCREEN) - 1;
                    let clamped_x = pt.x.clamp(0, max_x);
                    let clamped_y = pt.y.clamp(0, max_y);
                    if clamped_x != pt.x || clamped_y != pt.y {
                        let _ = SetCursorPos(clamped_x, clamped_y);
                    }
                }
            }
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (dx, dy, lock_primary);
        Err(ActionError::SendInputFailed("mouse not supported on this OS".into()))
    }
}

/// Mouse button names mirrored from `MouseButton` in the wire protocol.
pub enum MouseButton {
    Left,
    Right,
    Middle,
}

impl MouseButton {
    fn parse(s: &str) -> Result<Self, ActionError> {
        match s {
            "left" => Ok(MouseButton::Left),
            "right" => Ok(MouseButton::Right),
            "middle" => Ok(MouseButton::Middle),
            other => Err(ActionError::SendInputFailed(format!("Invalid mouse button: {}", other))),
        }
    }
}

/// Click state — `Click` is the down+up paired tap. `Down` and `Up` are
/// used by the drag flow to keep the button held while the cursor moves.
pub enum ClickState {
    Click,
    Down,
    Up,
}

impl ClickState {
    fn parse(s: &str) -> Result<Self, ActionError> {
        match s {
            "click" => Ok(ClickState::Click),
            "down" => Ok(ClickState::Down),
            "up" => Ok(ClickState::Up),
            other => Err(ActionError::SendInputFailed(format!("Invalid click state: {}", other))),
        }
    }
}

#[cfg(windows)]
fn button_flags(button: &MouseButton, state: &ClickState) -> (MOUSE_EVENT_FLAGS, MOUSE_EVENT_FLAGS) {
    // Returns (down_flag, up_flag) so callers can fire both in one step
    // for `Click` or pick one for `Down`/`Up`.
    match button {
        MouseButton::Left => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
        MouseButton::Right => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
        MouseButton::Middle => (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
    }
}

/// Send a button event (down, up, or paired click).
pub fn click(button_name: &str, state_name: &str) -> Result<(), ActionError> {
    let button = MouseButton::parse(button_name)?;
    let state = ClickState::parse(state_name)?;
    #[cfg(windows)]
    {
        let (down, up) = button_flags(&button, &state);
        match state {
            ClickState::Click => {
                let mi_down = MOUSEINPUT { dx: 0, dy: 0, mouseData: 0, dwFlags: down, time: 0, dwExtraInfo: 0 };
                let mi_up = MOUSEINPUT { dx: 0, dy: 0, mouseData: 0, dwFlags: up, time: 0, dwExtraInfo: 0 };
                send_mouse_input(mi_down)?;
                send_mouse_input(mi_up)?;
            }
            ClickState::Down => {
                let mi = MOUSEINPUT { dx: 0, dy: 0, mouseData: 0, dwFlags: down, time: 0, dwExtraInfo: 0 };
                send_mouse_input(mi)?;
            }
            ClickState::Up => {
                let mi = MOUSEINPUT { dx: 0, dy: 0, mouseData: 0, dwFlags: up, time: 0, dwExtraInfo: 0 };
                send_mouse_input(mi)?;
            }
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (button, state);
        Err(ActionError::SendInputFailed("mouse not supported on this OS".into()))
    }
}

/// Vertical scroll wheel delta. Convention: positive `dy` = scroll UP, which
/// matches the wire protocol. Windows `WHEEL_DELTA` is 120 per "click"; we
/// scale phone deltas (small integers) to feel right without being twitchy.
pub fn scroll(dx: i32, dy: i32) -> Result<(), ActionError> {
    #[cfg(windows)]
    {
        // Treat client-side `dy` of 1 as a single notch (~1/3 of a wheel
        // click). Multiply by 40 to get reasonable feel — tunable later via
        // sensitivity once the v1.2.1 acceleration curve lands.
        if dy != 0 {
            let mi = MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouseData: (dy * 40) as i32 as u32,
                dwFlags: MOUSEEVENTF_WHEEL,
                time: 0,
                dwExtraInfo: 0,
            };
            send_mouse_input(mi)?;
        }
        if dx != 0 {
            let mi = MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouseData: (dx * 40) as i32 as u32,
                dwFlags: MOUSEEVENTF_HWHEEL,
                time: 0,
                dwExtraInfo: 0,
            };
            send_mouse_input(mi)?;
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (dx, dy);
        Err(ActionError::SendInputFailed("mouse not supported on this OS".into()))
    }
}

/// Drag flow: the phone fires `start` (left button down) at the moment the
/// long-press is recognised, the cursor then moves freely via `mouse_move`,
/// and `end` (left button up) fires when the user lifts.
pub fn drag(phase: &str) -> Result<(), ActionError> {
    match phase {
        "start" => click("left", "down"),
        "end" => click("left", "up"),
        other => Err(ActionError::SendInputFailed(format!("Invalid drag phase: {}", other))),
    }
}

#[cfg(windows)]
fn send_mouse_input(mi: MOUSEINPUT) -> Result<(), ActionError> {
    let input = INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 { mi },
    };
    let inputs = [input];
    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    if sent == 0 {
        return Err(ActionError::SendInputFailed("SendInput returned 0 events".into()));
    }
    Ok(())
}
