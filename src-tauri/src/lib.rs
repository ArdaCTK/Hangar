mod commands;
mod models;

use commands::{
    activity::get_activity_data,
    files::{get_file_tree, get_project_details, open_in_explorer, read_project_file, git_checkout},
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
            // settings & notes
            load_settings,
            save_settings,
            load_notes,
            save_note,
            delete_note,
            // scanning
            scan_projects,
            get_project_details,
            // files
            get_file_tree,
            read_project_file,
            open_in_explorer,
            // git
            git_checkout,
            // github
            fetch_github,
            fetch_github_user_repos,
            // terminal & scripts
            terminal_run,
            terminal_kill,
            get_project_scripts,
            // search
            search_projects,
            // junk
            detect_junk,
            delete_junk_items,
            // ports
            scan_ports,
            // activity
            get_activity_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
