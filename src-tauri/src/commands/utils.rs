use std::process::Command;

/// Build a Command that never opens a console window on Windows.
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

/// Returns the machine hostname without spawning a subprocess.
///
/// FIX (Güvenlik): Önceki implementasyon `Command::new("hostname")` çalıştırıyordu.
/// PATH manipülasyonu veya binary override durumunda vault/token anahtar türetimi
/// farklı bir değer döndürebilirdi. `sysinfo` crate'i OS API'lerini doğrudan
/// kullandığından subprocess saldırı yüzeyi ortadan kalkar.
pub fn get_machine_hostname() -> String {
    sysinfo::System::host_name()
        .unwrap_or_else(|| "unknown-host".to_string())
}
