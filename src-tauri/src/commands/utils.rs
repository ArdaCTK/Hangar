use std::process::Command;

/// Build a Command that never opens a console window on Windows.
/// On all platforms, runs the given program with the given args.
pub fn silent_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    apply_no_window(&mut cmd);
    cmd
}

/// Apply CREATE_NO_WINDOW flag on Windows to suppress CMD popups.
pub fn apply_no_window(cmd: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = cmd;
    }
}
