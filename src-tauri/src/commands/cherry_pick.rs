use std::path::Path;

use crate::error::GitError;
use crate::git::cherry_pick;
use crate::git::types::CherryPickResult;

#[tauri::command]
pub async fn git_cherry_pick(
    repo_path: String,
    sha: String,
) -> Result<CherryPickResult, GitError> {
    cherry_pick::cherry_pick(Path::new(&repo_path), &sha).await
}

#[tauri::command]
pub async fn git_cherry_pick_abort(repo_path: String) -> Result<(), GitError> {
    cherry_pick::abort(Path::new(&repo_path)).await
}
