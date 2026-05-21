pub mod commands;
pub mod config;
pub mod error;
pub mod git;
pub mod workspace;

use tauri::{Emitter, Manager};

pub fn run() {
    // Note: do not call tracing_subscriber::fmt::init() here — it claims
    // `log::set_logger`, which tauri_plugin_log also needs. Logging is owned
    // by tauri_plugin_log (registered below); tracing macros become no-ops.

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
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
            commands::ai::ai_generate_commit_message,
            commands::repo::git_init,
            commands::repo::git_clone,
            commands::repo::git_get_config,
            commands::repo::git_set_config,
            commands::repo::git_get_user_info,
            commands::repo::git_version,
            commands::blame::git_blame,
            commands::blame::git_blame_line,
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
            commands::branch::git_delete_remote_branch,
            commands::branch::git_set_upstream,
            commands::branch::git_unset_upstream,
            commands::branch::git_compare_branches,
            commands::cherry_pick::git_cherry_pick,
            commands::cherry_pick::git_cherry_pick_abort,
            commands::conflict::git_list_conflicts,
            commands::conflict::git_get_conflict_content,
            commands::conflict::git_mark_resolved,
            commands::conflict::git_set_conflict_content,
            commands::conflict::git_continue_merge,
            commands::remote::git_list_remotes,
            commands::remote::git_add_remote,
            commands::remote::git_remove_remote,
            commands::remote::git_rename_remote,
            commands::remote::git_fetch,
            commands::remote::git_fetch_all,
            commands::remote::git_fetch_prune,
            commands::remote::git_pull,
            commands::remote::git_pull_ff_only,
            commands::remote::git_pull_rebase,
            commands::remote::git_push,
            commands::remote::git_push_set_upstream,
            commands::remote::git_sync,
            commands::stash::git_stash_list,
            commands::stash::git_stash_push,
            commands::stash::git_stash_pop,
            commands::stash::git_stash_apply,
            commands::stash::git_stash_drop,
            commands::stash::git_stash_show,
            commands::stash::git_stash_clear,
            commands::tag::git_list_tags,
            commands::tag::git_create_tag,
            commands::tag::git_delete_tag,
            commands::tag::git_push_tag,
            commands::worktree::git_list_worktrees,
            commands::worktree::git_add_worktree,
            commands::worktree::git_remove_worktree,
            commands::worktree::git_prune_worktrees,
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
            commands::staging::git_add_to_gitignore,
            commands::commit::git_commit,
            commands::commit::git_commit_all,
            commands::commit::git_commit_amend,
            commands::commit::git_undo_last_commit,
            commands::commit::git_revert_commit,
            commands::commit::git_reset_to_commit,
            commands::commit::git_log,
            commands::graph::git_graph,
            commands::graph::git_ref_log,
            commands::rebase::git_list_rebase_candidates,
            commands::rebase::git_rebase_interactive,
            commands::rebase::git_rebase_continue,
            commands::diff::git_show_commit,
            commands::diff::git_commit_diff,
            commands::diff::git_diff_refs,
            commands::diff::git_diff_merge_base,
            commands::diff::git_file_bytes,
            commands::diff::git_diff_patch_file,
            commands::diff::git_restore_file_from_commit,
            commands::misc::git_bisect,
            commands::misc::git_submodule_status,
            commands::misc::git_submodule_init,
            commands::misc::git_submodule_update,
            commands::misc::git_sparse_list,
            commands::misc::git_sparse_set,
            commands::misc::git_sparse_disable,
            commands::misc::git_lfs_status,
            commands::misc::git_lfs_locks,
            commands::misc::git_lfs_lock,
            commands::misc::git_lfs_unlock,
            commands::misc::git_hooks,
            commands::misc::git_hook_read,
            commands::misc::git_patch_create,
            commands::misc::git_patch_apply,
            commands::misc::git_remote_set_url,
            commands::misc::git_pr_remotes,
            commands::discard::git_discard_file,
            commands::discard::git_discard_all,
            commands::discard::git_discard_lines,
            commands::discard::git_clean_untracked,
            commands::external::open_file_in_editor,
            commands::external::reveal_file_in_manager,
            commands::workspace::open_workspace_file,
            commands::workspace::open_repository_target,
            commands::workspace::add_repository_target,
            commands::updates::check_for_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
