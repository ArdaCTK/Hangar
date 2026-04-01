mod commands;
mod models;

use commands::{
    files::{get_file_tree, get_project_details, open_in_explorer, read_project_file, git_checkout},
    github::{fetch_github, fetch_github_user_repos},
    scanner::scan_projects,
    settings::{load_settings, save_settings},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            scan_projects,
            get_project_details,
            get_file_tree,
            read_project_file,
            open_in_explorer,
            git_checkout,
            fetch_github,
            fetch_github_user_repos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
