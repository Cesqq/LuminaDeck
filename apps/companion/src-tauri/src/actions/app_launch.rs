use super::ActionError;
use std::process::Command;

/// Launch an application by path with optional arguments.
/// Path is validated: no "..", no "~", must end in valid extension.
/// Never invokes cmd.exe or powershell — direct process creation only.
pub fn launch_app(path: &str, args: Option<&[String]>) -> Result<(), ActionError> {
    // Validate path (defense in depth — also validated on mobile side)
    if path.contains("..") || path.contains('~') {
        return Err(ActionError::InvalidPath(
            "Path contains directory traversal characters".to_string(),
        ));
    }

    let valid_extensions = [".exe", ".lnk", ".bat", ".cmd", ".msc", ".cpl"];
    let lower_path = path.to_lowercase();
    if !valid_extensions.iter().any(|ext| lower_path.ends_with(ext)) {
        return Err(ActionError::InvalidPath(format!(
            "Path must end with one of: {:?}",
            valid_extensions
        )));
    }

    // Verify path exists
    if !std::path::Path::new(path).exists() {
        return Err(ActionError::LaunchFailed(format!(
            "File not found: {}",
            path
        )));
    }

    // Launch without shell — direct CreateProcess
    let mut cmd = Command::new(path);
    if let Some(args) = args {
        cmd.args(args);
    }

    cmd.spawn().map_err(|e| {
        ActionError::LaunchFailed(format!("Failed to launch {}: {}", path, e))
    })?;

    Ok(())
}
