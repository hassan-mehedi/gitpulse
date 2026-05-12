use std::path::Path;

use tauri::{AppHandle, Runtime, State};

use crate::error::GitError;
use crate::git::types::{Repository, WorkspaceState};
use crate::workspace::code_workspace;
use crate::workspace::manager::{collect_multi_repos, is_git_repo, scan_repo, WorkspaceManager};

#[tauri::command]
pub async fn open_workspace_file(file_path: String) -> Result<Vec<Repository>, GitError> {
    code_workspace::open_workspace_file(Path::new(&file_path)).await
}

async fn resolve_target_repositories(path: &str) -> Result<Vec<Repository>, GitError> {
    let candidate = Path::new(path);

    if path.ends_with(".code-workspace") {
        return code_workspace::open_workspace_file(candidate).await;
    }

    if is_git_repo(candidate).await {
        return Ok(vec![scan_repo(candidate).await?]);
    }

    collect_multi_repos(candidate).await
}

#[tauri::command]
pub async fn open_repository_target<R: Runtime>(
    app_handle: AppHandle<R>,
    path: String,
    workspace_manager: State<'_, WorkspaceManager>,
) -> Result<WorkspaceState, GitError> {
    let candidate = Path::new(&path);
    if path.ends_with(".code-workspace") {
        let repositories = code_workspace::open_workspace_file(candidate).await?;
        return workspace_manager.open_workspace_file(&app_handle, path, repositories);
    }

    if is_git_repo(candidate).await {
        workspace_manager
            .open_single_repo(&app_handle, candidate)
            .await
    } else {
        workspace_manager
            .open_multi_repo(&app_handle, candidate)
            .await
    }
}

#[tauri::command]
pub async fn add_repository_target<R: Runtime>(
    app_handle: AppHandle<R>,
    path: String,
    workspace_manager: State<'_, WorkspaceManager>,
) -> Result<WorkspaceState, GitError> {
    let repositories = resolve_target_repositories(&path).await?;
    if repositories.is_empty() {
        return Err(GitError::Io(
            "No Git repositories were found in the selected location.".to_string(),
        ));
    }

    workspace_manager.append_repositories(&app_handle, repositories)
}
