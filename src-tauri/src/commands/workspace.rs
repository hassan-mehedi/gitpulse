use std::path::Path;

use tauri::{AppHandle, Runtime, State};

use crate::error::GitError;
use crate::git::types::{Repository, WorkspaceState};
use crate::workspace::code_workspace;
use crate::workspace::manager::{is_git_repo, WorkspaceManager};

#[tauri::command]
pub async fn open_workspace_file(file_path: String) -> Result<Vec<Repository>, GitError> {
    code_workspace::open_workspace_file(Path::new(&file_path)).await
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
        workspace_manager.open_single_repo(&app_handle, candidate).await
    } else {
        workspace_manager.open_multi_repo(&app_handle, candidate).await
    }
}
