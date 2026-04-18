mod commands;
mod models;

use commands::{
    activity::get_activity_data,
    files::{get_file_tree, get_project_details, open_in_explorer, open_in_vscode, read_project_file, git_checkout},
    git::get_git_log_for_branch,
    github::{fetch_github, fetch_github_user_repos, fetch_github_issues, fetch_all_repos_issues, fetch_github_comments, post_github_comment},
    junk::{detect_junk, delete_junk_items},
    mod_ports::scan_ports,
    pingboard::{ping_add_monitor, ping_remove_monitor, ping_get_all_monitors, ping_check_now, ping_get_history, ping_update_monitor},
    scanner::scan_projects,
    search::search_projects,
    settings::{load_settings, save_settings, load_notes, save_note, delete_note},
    terminal::{terminal_run, terminal_kill, get_project_scripts, TerminalState},
    timetracker::{time_get_weekly_report, time_get_monthly_report, time_export_csv},
    vault::{vault_get_all, vault_add_secret, vault_add_secrets_batch, vault_delete_secret, vault_export_env, vault_import_env, vault_scan_project_env},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(TerminalState::new())
        .invoke_handler(tauri::generate_handler![
            // Settings & Notes
            load_settings, save_settings, load_notes, save_note, delete_note,
            // Scanning
            scan_projects, get_project_details,
            // Files
            get_file_tree, read_project_file, open_in_explorer, open_in_vscode,
            git_checkout, get_git_log_for_branch,
            // GitHub
            fetch_github, fetch_github_user_repos,
            fetch_github_issues, fetch_all_repos_issues, fetch_github_comments, post_github_comment,
            // Terminal
            terminal_run, terminal_kill, get_project_scripts,
            // Search & Junk & Ports & Activity
            search_projects,
            detect_junk, delete_junk_items,
            scan_ports,
            get_activity_data,
            // Vaultkeeper
            vault_get_all, vault_add_secret, vault_add_secrets_batch, vault_delete_secret, vault_export_env, vault_import_env, vault_scan_project_env,
            // PingBoard
            ping_add_monitor, ping_remove_monitor, ping_get_all_monitors, ping_check_now, ping_get_history, ping_update_monitor,
            // Meridian
            time_get_weekly_report, time_get_monthly_report, time_export_csv,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
