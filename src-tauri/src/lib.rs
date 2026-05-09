pub mod commands;
pub mod config;
pub mod error;
pub mod git;
pub mod workspace;

use tauri::{Emitter, Manager};

pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            app.manage(workspace::manager::WorkspaceManager::default());
            let main_window = app.get_webview_window("main");
            if let Some(window) = main_window {
                tauri::async_runtime::spawn(async move {
                    if let Ok(version) = git::runner::GitRunner::version().await {
                        let _ = window.emit("git:version", version);
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::repo::git_detect_repo,
            commands::repo::git_init,
            commands::repo::git_clone,
            commands::repo::git_get_config,
            commands::repo::git_set_config,
            commands::repo::git_get_user_info,
            commands::blame::git_blame,
            commands::branch::git_branches,
            commands::branch::git_current_branch,
            commands::branch::git_create_branch,
            commands::branch::git_switch_branch,
            commands::branch::git_rename_branch,
            commands::branch::git_delete_branch,
            commands::branch::git_merge,
            commands::branch::git_rebase,
            commands::branch::git_abort_merge,
            commands::branch::git_abort_rebase,
            commands::remote::git_list_remotes,
            commands::remote::git_add_remote,
            commands::remote::git_remove_remote,
            commands::remote::git_rename_remote,
            commands::remote::git_fetch,
            commands::remote::git_fetch_all,
            commands::remote::git_fetch_prune,
            commands::remote::git_pull,
            commands::remote::git_pull_rebase,
            commands::remote::git_push,
            commands::remote::git_push_set_upstream,
            commands::remote::git_sync,
            commands::status::git_status,
            commands::status::git_diff_file,
            commands::status::git_diff_stat,
            commands::status::git_diff_staged_stat,
            commands::staging::git_stage_file,
            commands::staging::git_stage_files,
            commands::staging::git_stage_all,
            commands::staging::git_stage_dir,
            commands::staging::git_stage_lines,
            commands::staging::git_unstage_file,
            commands::staging::git_unstage_all,
            commands::staging::git_unstage_lines,
            commands::commit::git_commit,
            commands::commit::git_commit_all,
            commands::commit::git_commit_amend,
            commands::commit::git_undo_last_commit,
            commands::commit::git_log,
            commands::graph::git_graph,
            commands::graph::git_ref_log,
            commands::diff::git_show_commit,
            commands::diff::git_commit_diff,
            commands::diff::git_diff_refs,
            commands::diff::git_diff_merge_base,
            commands::discard::git_discard_file,
            commands::discard::git_discard_all,
            commands::discard::git_discard_lines,
            commands::discard::git_clean_untracked,
            commands::workspace::open_workspace_file,
            commands::workspace::open_repository_target
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
