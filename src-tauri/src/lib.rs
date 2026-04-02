mod commands;
mod models;

use commands::{
    activity::get_activity_data,
    files::{get_file_tree, get_project_details, open_in_explorer, open_in_vscode, read_project_file, git_checkout},
    git::get_git_log_for_branch,
    github::{fetch_github, fetch_github_user_repos},
    junk::{detect_junk, delete_junk_items},
    mod_ports::scan_ports,
    scanner::scan_projects,
    search::search_projects,
    settings::{load_settings, save_settings, load_notes, save_note, delete_note},
    terminal::{terminal_run, terminal_kill, get_project_scripts, TerminalState},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(TerminalState::new())
        .invoke_handler(tauri::generate_handler![
            load_settings, save_settings, load_notes, save_note, delete_note,
            scan_projects, get_project_details,
            get_file_tree, read_project_file, open_in_explorer, open_in_vscode,
            git_checkout, get_git_log_for_branch,
            fetch_github, fetch_github_user_repos,
            terminal_run, terminal_kill, get_project_scripts,
            search_projects,
            detect_junk, delete_junk_items,
            scan_ports,
            get_activity_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
