use crate::models::PortInfo;
use std::net::TcpStream;
use std::time::Duration;

const DEV_PORTS: &[(u16, &str)] = &[
    (3000,  "React / Next.js / Express"),
    (3001,  "Alt React / CRA"),
    (4173,  "Vite preview"),
    (5173,  "Vite dev"),
    (5174,  "Vite dev (alt)"),
    (5000,  "Flask / Generic"),
    (8000,  "Django / FastAPI"),
    (8080,  "Generic dev"),
    (8081,  "Alt generic"),
    (8888,  "Jupyter Notebook"),
    (4000,  "Gatsby / Phoenix"),
    (4200,  "Angular"),
    (4321,  "Astro"),
    (9000,  "Webpack / SonarQube"),
    (1420,  "Tauri vite"),
    (19006, "Expo"),
    (3030,  "Svelte REPL"),
    (6006,  "Storybook"),
    (7777,  "Payload CMS"),
    (2019,  "Caddy admin"),
    (11434, "Ollama"),
    (5432,  "PostgreSQL"),
    (3306,  "MySQL"),
    (6379,  "Redis"),
    (27017, "MongoDB"),
];

fn is_port_open(port: u16) -> bool {
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{}", port).parse().unwrap(),
        Duration::from_millis(80),
    ).is_ok()
}

#[tauri::command]
pub fn scan_ports() -> Vec<PortInfo> {
    // Run port checks concurrently using threads
    use std::sync::{Arc, Mutex};
    let results: Arc<Mutex<Vec<PortInfo>>> = Arc::new(Mutex::new(Vec::new()));
    let mut handles = Vec::new();

    for &(port, hint) in DEV_PORTS {
        let results = Arc::clone(&results);
        let hint = hint.to_string();
        handles.push(std::thread::spawn(move || {
            let open = is_port_open(port);
            results.lock().unwrap().push(PortInfo {
                port,
                open,
                likely_project: None,
                service_hint: hint,
            });
        }));
    }

    for h in handles { let _ = h.join(); }

    let mut res = results.lock().unwrap().clone();
    res.sort_by_key(|p| p.port);
    res
}
