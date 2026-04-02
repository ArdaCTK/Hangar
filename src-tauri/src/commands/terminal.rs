use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Emitter};

pub struct TerminalState {
    pub children: Mutex<HashMap<String, std::process::Child>>,
}

impl TerminalState {
    pub fn new() -> Self {
        Self { children: Mutex::new(HashMap::new()) }
    }
}

/// On Windows, npm/pnpm/yarn are .cmd scripts — must be run via cmd.exe /C.
/// Returns (program, prepended_args).
fn shell_wrap(program: &str, args: &[String]) -> (String, Vec<String>) {
    #[cfg(target_os = "windows")]
    {
        let mut full_args = vec!["/C".to_string(), program.to_string()];
        full_args.extend_from_slice(args);
        return ("cmd".to_string(), full_args);
    }
    #[cfg(not(target_os = "windows"))]
    {
        (program.to_string(), args.to_vec())
    }
}

#[tauri::command]
pub fn terminal_run(
    app: AppHandle,
    id: String,
    path: String,
    program: String,
    args: Vec<String>,
) -> Result<(), String> {
    // Kill existing process with this ID
    {
        let state = app.state::<TerminalState>();
        let mut children = state.children.lock().unwrap();
        if let Some(mut old) = children.remove(&id) {
            let _ = old.kill();
        }
    }

    let (resolved_prog, resolved_args) = shell_wrap(&program, &args);

    let mut cmd = std::process::Command::new(&resolved_prog);
    cmd.args(&resolved_args)
       .current_dir(&path)
       .stdout(std::process::Stdio::piped())
       .stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn '{}': {}. Make sure Node.js/npm is installed and in PATH.", resolved_prog, e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    {
        let state = app.state::<TerminalState>();
        let mut children = state.children.lock().unwrap();
        children.insert(id.clone(), child);
    }

    if let Some(stdout) = stdout {
        let app_s = app.clone();
        let id_s  = id.clone();
        std::thread::spawn(move || {
            use std::io::BufRead;
            for line in std::io::BufReader::new(stdout).lines().flatten() {
                let _ = app_s.emit(&format!("term-data-{}", id_s), line + "\r\n");
            }
        });
    }

    if let Some(stderr) = stderr {
        let app_e = app.clone();
        let id_e  = id.clone();
        std::thread::spawn(move || {
            use std::io::BufRead;
            for line in std::io::BufReader::new(stderr).lines().flatten() {
                let _ = app_e.emit(&format!("term-data-{}", id_e), line + "\r\n");
            }
        });
    }

    {
        let app_w = app.clone();
        let id_w  = id.clone();
        std::thread::spawn(move || {
            let code = {
                let state = app_w.state::<TerminalState>();
                let mut children = state.children.lock().unwrap();
                if let Some(child) = children.get_mut(&id_w) {
                    child.wait().map(|s| s.code().unwrap_or(0)).unwrap_or(-1)
                } else { -1 }
            };
            let _ = app_w.emit(&format!("term-exit-{}", id_w), code);
        });
    }

    Ok(())
}

#[tauri::command]
pub fn terminal_kill(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<TerminalState>();
    let mut children = state.children.lock().unwrap();
    if let Some(mut child) = children.remove(&id) {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_project_scripts(path: String) -> Vec<ScriptInfo> {
    let mut scripts = Vec::new();
    let root = std::path::Path::new(&path);

    // package.json — npm scripts
    let pkg = root.join("package.json");
    if pkg.exists() {
        if let Ok(raw) = std::fs::read_to_string(&pkg) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) {
                if let Some(obj) = val.get("scripts").and_then(|v| v.as_object()) {
                    // Detect package manager
                    let pm = if root.join("pnpm-lock.yaml").exists() { "pnpm" }
                        else if root.join("yarn.lock").exists() { "yarn" }
                        else { "npm" };

                    for (name, cmd) in obj {
                        scripts.push(ScriptInfo {
                            name: format!("{} run {}", pm, name),
                            command: format!("{} run {}", pm, name),
                            program: pm.to_string(),
                            args: vec!["run".to_string(), name.clone()],
                            ecosystem: "npm".to_string(),
                            hint: cmd.as_str().unwrap_or("").to_string(),
                        });
                    }
                }
            }
        }
    }

    // Cargo.toml
    let cargo = root.join("Cargo.toml");
    if cargo.exists() {
        for (name, args) in &[
            ("build",   vec!["build"]),
            ("run",     vec!["run"]),
            ("test",    vec!["test"]),
            ("clippy",  vec!["clippy"]),
            ("fmt",     vec!["fmt"]),
            ("check",   vec!["check"]),
        ] {
            scripts.push(ScriptInfo {
                name: format!("cargo {}", name),
                command: format!("cargo {}", name),
                program: "cargo".to_string(),
                args: args.iter().map(|s| s.to_string()).collect(),
                ecosystem: "cargo".to_string(),
                hint: String::new(),
            });
        }
    }

    // Makefile targets
    let makefile = root.join("Makefile");
    if makefile.exists() {
        if let Ok(raw) = std::fs::read_to_string(&makefile) {
            for line in raw.lines().take(80) {
                if let Some(target) = line.strip_suffix(':') {
                    let t = target.trim();
                    if !t.is_empty() && !t.starts_with('.') && !t.contains(' ') && !t.contains('$') {
                        scripts.push(ScriptInfo {
                            name: format!("make {}", t),
                            command: format!("make {}", t),
                            program: "make".to_string(),
                            args: vec![t.to_string()],
                            ecosystem: "make".to_string(),
                            hint: String::new(),
                        });
                    }
                }
            }
        }
    }

    scripts
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ScriptInfo {
    pub name: String,
    pub command: String,
    pub program: String,
    pub args: Vec<String>,
    pub ecosystem: String,
    pub hint: String,
}
