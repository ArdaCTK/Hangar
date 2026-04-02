use crate::models::PortInfo;
use std::net::TcpStream;
use std::time::Duration;

const DEV_PORTS: &[(u16, &str)] = &[
    // Tauri / Vite — listed first so they're prominent
    (1420,  "Tauri / Vite dev"),
    (5173,  "Vite dev"),
    (5174,  "Vite dev (alt)"),
    (4173,  "Vite preview"),
    // React / Next
    (3000,  "React / Next.js / Express"),
    (3001,  "CRA / Alt React"),
    // Other frameworks
    (4200,  "Angular"),
    (4321,  "Astro"),
    (4000,  "Gatsby / Phoenix"),
    (3030,  "Svelte"),
    (6006,  "Storybook"),
    (7777,  "Payload CMS"),
    // Node / Python backends
    (5000,  "Flask / Generic"),
    (8000,  "Django / FastAPI"),
    (8080,  "Generic dev server"),
    (8081,  "Alt generic"),
    (9000,  "Webpack / SonarQube"),
    // Mobile
    (19006, "Expo"),
    (8081,  "React Native Metro"),
    // Tools
    (8888,  "Jupyter Notebook"),
    (11434, "Ollama"),
    (6006,  "Storybook"),
    // Databases (often running locally)
    (5432,  "PostgreSQL"),
    (3306,  "MySQL / MariaDB"),
    (6379,  "Redis"),
    (27017, "MongoDB"),
    (5984,  "CouchDB"),
    // Misc
    (2019,  "Caddy admin"),
    (9229,  "Node.js debugger"),
];

fn is_port_open(port: u16) -> bool {
    // Use 150ms — enough for localhost, avoids false negatives on slow Windows startup
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{}", port).parse().unwrap(),
        Duration::from_millis(150),
    ).is_ok()
}

#[tauri::command]
pub fn scan_ports() -> Vec<PortInfo> {
    use std::sync::{Arc, Mutex};
    use std::collections::HashSet;

    let results: Arc<Mutex<Vec<PortInfo>>> = Arc::new(Mutex::new(Vec::new()));
    let mut handles = Vec::new();
    let mut seen_ports = HashSet::new();

    for &(port, hint) in DEV_PORTS {
        if !seen_ports.insert(port) { continue; } // deduplicate
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
    // Sort: open ports first, then by port number
    res.sort_by(|a, b| b.open.cmp(&a.open).then(a.port.cmp(&b.port)));
    res
}
