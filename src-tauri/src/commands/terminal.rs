use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri::Emitter;

/// Global state holding running process handles
pub struct TerminalState {
    pub children: Mutex<HashMap<String, std::process::Child>>,
}

impl TerminalState {
    pub fn new() -> Self {
        Self { children: Mutex::new(HashMap::new()) }
    }
}

/// Spawn a process, stream stdout+stderr as tauri events.
/// Events emitted:
///   "term-data-{id}"  -> String  (output chunk)
///   "term-exit-{id}"  -> i32     (exit code)
#[tauri::command]
pub fn terminal_run(
    app: AppHandle,
    id: String,
    path: String,
    program: String,
    args: Vec<String>,
) -> Result<(), String> {
    // Kill any existing process with this ID
    {
        let state = app.state::<TerminalState>();
        let mut children = state.children.lock().unwrap();
        if let Some(mut old) = children.remove(&id) {
            let _ = old.kill();
        }
    }

    let mut cmd = std::process::Command::new(&program);
    cmd.args(&args)
       .current_dir(&path)
       .stdout(std::process::Stdio::piped())
       .stderr(std::process::Stdio::piped());

    // On Windows, don't open extra console window
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn '{}': {}", program, e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Store child for later kill
    {
        let state = app.state::<TerminalState>();
        let mut children = state.children.lock().unwrap();
        children.insert(id.clone(), child);
    }

    let app2 = app.clone();
    let id2  = id.clone();

    // Stream stdout in thread
    if let Some(stdout) = stdout {
        let app_s  = app.clone();
        let id_s   = id.clone();
        std::thread::spawn(move || {
            use std::io::BufRead;
            let reader = std::io::BufReader::new(stdout);
            for line in reader.lines().flatten() {
                let _ = app_s.emit(&format!("term-data-{}", id_s), line + "\r\n");
            }
        });
    }

    // Stream stderr in thread
    if let Some(stderr) = stderr {
        let app_e = app2.clone();
        let id_e  = id2.clone();
        std::thread::spawn(move || {
            use std::io::BufRead;
            let reader = std::io::BufReader::new(stderr);
            for line in reader.lines().flatten() {
                let _ = app_e.emit(&format!("term-data-{}", id_e), line + "\r\n");
            }
        });
    }

    // Wait for exit in another thread
    {
        let app_w  = app2;
        let id_w   = id2;
        let state_app = app_w.clone();
        std::thread::spawn(move || {
            let code = {
                let state = state_app.state::<TerminalState>();
                let mut children = state.children.lock().unwrap();
                if let Some(child) = children.get_mut(&id_w) {
                    child.wait().map(|s| s.code().unwrap_or(0)).unwrap_or(-1)
                } else {
                    -1
                }
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

/// Read available npm/cargo/python scripts from a project
#[tauri::command]
pub fn get_project_scripts(path: String) -> Vec<ScriptInfo> {
    let mut scripts = Vec::new();
    let root = std::path::Path::new(&path);

    // package.json scripts
    let pkg = root.join("package.json");
    if pkg.exists() {
        if let Ok(raw) = std::fs::read_to_string(&pkg) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) {
                if let Some(obj) = val.get("scripts").and_then(|v| v.as_object()) {
                    for (name, cmd) in obj {
                        scripts.push(ScriptInfo {
                            name: name.clone(),
                            command: format!("npm run {}", name),
                            program: "npm".to_string(),
                            args: vec!["run".to_string(), name.clone()],
                            ecosystem: "npm".to_string(),
                            hint: cmd.as_str().unwrap_or("").to_string(),
                        });
                    }
                }
            }
        }
    }

    // Cargo targets (bin + example)
    let cargo = root.join("Cargo.toml");
    if cargo.exists() {
        if let Ok(raw) = std::fs::read_to_string(&cargo) {
            if let Ok(val) = raw.parse::<toml::Value>() {
                // Standard cargo commands
                for (name, args) in &[
                    ("build",     vec!["build"]),
                    ("run",       vec!["run"]),
                    ("test",      vec!["test"]),
                    ("clippy",    vec!["clippy"]),
                    ("fmt",       vec!["fmt"]),
                    ("check",     vec!["check"]),
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
                let _ = val; // suppress unused warning
            }
        }
    }

    // Makefile targets (first 20 lines)
    let makefile = root.join("Makefile");
    if makefile.exists() {
        if let Ok(raw) = std::fs::read_to_string(&makefile) {
            for line in raw.lines().take(60) {
                if let Some(target) = line.strip_suffix(':') {
                    let t = target.trim();
                    if !t.is_empty() && !t.starts_with('.') && !t.contains(' ') {
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
