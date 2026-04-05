use crate::models::{Monitor, PingRecord};
use std::collections::HashMap;
use std::path::PathBuf;

fn pingboard_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("hangar")
}

fn monitors_path() -> PathBuf { pingboard_dir().join("monitors.json") }
fn history_path() -> PathBuf { pingboard_dir().join("ping_history.json") }

fn ensure_dir() {
    let _ = std::fs::create_dir_all(pingboard_dir());
}

fn load_monitors() -> Vec<Monitor> {
    let path = monitors_path();
    if !path.exists() { return Vec::new(); }
    serde_json::from_str(&std::fs::read_to_string(&path).unwrap_or_default())
        .unwrap_or_default()
}

fn save_monitors(monitors: &[Monitor]) -> Result<(), String> {
    ensure_dir();
    let raw = serde_json::to_string_pretty(monitors).map_err(|e| e.to_string())?;
    std::fs::write(monitors_path(), raw).map_err(|e| e.to_string())
}

fn load_history() -> HashMap<String, Vec<PingRecord>> {
    let path = history_path();
    if !path.exists() { return HashMap::new(); }
    serde_json::from_str(&std::fs::read_to_string(&path).unwrap_or_default())
        .unwrap_or_default()
}

fn save_history(history: &HashMap<String, Vec<PingRecord>>) -> Result<(), String> {
    ensure_dir();
    let raw = serde_json::to_string_pretty(history).map_err(|e| e.to_string())?;
    std::fs::write(history_path(), raw).map_err(|e| e.to_string())
}

fn now_ts() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    format!("mon_{}", ts)
}

#[tauri::command]
pub fn ping_add_monitor(name: String, url: String, interval_seconds: u32, method: String) -> Result<Monitor, String> {
    let mut monitors = load_monitors();
    let monitor = Monitor {
        id: generate_id(),
        name, url, method, interval_seconds,
        is_active: true,
        last_status: "unknown".to_string(),
        last_response_ms: None,
        last_checked_at: None,
        uptime_24h: 100.0,
        created_at: now_ts(),
    };
    monitors.push(monitor.clone());
    save_monitors(&monitors)?;
    Ok(monitor)
}

#[tauri::command]
pub fn ping_remove_monitor(id: String) -> Result<(), String> {
    let mut monitors = load_monitors();
    monitors.retain(|m| m.id != id);
    save_monitors(&monitors)?;
    let mut history = load_history();
    history.remove(&id);
    save_history(&history)?;
    Ok(())
}

#[tauri::command]
pub fn ping_get_all_monitors() -> Vec<Monitor> { load_monitors() }

#[tauri::command]
pub async fn ping_check_now(id: String) -> Result<Monitor, String> {
    let mut monitors = load_monitors();
    let monitor = monitors.iter_mut().find(|m| m.id == id)
        .ok_or("Monitor not found")?;

    // Build client without accepting invalid certs — production monitors should have valid SSL.
    // For local HTTP services, use http:// instead of https://.
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let start = std::time::Instant::now();
    let result = match monitor.method.as_str() {
        "HEAD" => client.head(&monitor.url).send().await,
        "POST" => client.post(&monitor.url).send().await,
        _      => client.get(&monitor.url).send().await,
    };

    let elapsed_ms = start.elapsed().as_millis() as u32;
    let now = now_ts();

    let record = match &result {
        Ok(resp) => {
            let status_code = resp.status().as_u16();
            let status = if resp.status().is_success() { "up" }
                else if status_code >= 500 { "down" }
                else { "degraded" };
            monitor.last_status = status.to_string();
            monitor.last_response_ms = Some(elapsed_ms);
            monitor.last_checked_at = Some(now);
            PingRecord {
                timestamp: now, status: status.to_string(),
                response_ms: elapsed_ms, status_code: Some(status_code), error: None,
            }
        },
        Err(e) => {
            monitor.last_status = "down".to_string();
            monitor.last_response_ms = None;
            monitor.last_checked_at = Some(now);
            PingRecord {
                timestamp: now, status: "down".to_string(),
                response_ms: elapsed_ms, status_code: None, error: Some(e.to_string()),
            }
        }
    };

    let mut history = load_history();
    let records = history.entry(id.clone()).or_default();
    records.push(record);

    let cutoff = now - 86400;
    records.retain(|r| r.timestamp > cutoff);

    if !records.is_empty() {
        let up_count = records.iter().filter(|r| r.status == "up").count();
        monitor.uptime_24h = (up_count as f64 / records.len() as f64 * 100.0 * 10.0).round() / 10.0;
    }

    let result_monitor = monitor.clone();
    save_monitors(&monitors)?;
    save_history(&history)?;
    Ok(result_monitor)
}

#[tauri::command]
pub fn ping_get_history(id: String) -> Vec<PingRecord> {
    load_history().get(&id).cloned().unwrap_or_default()
}

#[tauri::command]
pub fn ping_update_monitor(id: String, name: String, url: String, interval_seconds: u32, method: String, is_active: bool) -> Result<(), String> {
    let mut monitors = load_monitors();
    if let Some(m) = monitors.iter_mut().find(|m| m.id == id) {
        m.name = name; m.url = url;
        m.interval_seconds = interval_seconds;
        m.method = method; m.is_active = is_active;
    }
    save_monitors(&monitors)
}
