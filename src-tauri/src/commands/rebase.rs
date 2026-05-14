use std::path::Path;

use crate::error::GitError;
use crate::git::rebase::{self, RebaseCandidate};
use crate::git::types::OperationResult;

#[tauri::command]
pub async fn git_list_rebase_candidates(
    repo_path: String,
    base_sha: String,
) -> Result<Vec<RebaseCandidate>, GitError> {
    rebase::list_rebase_candidates(Path::new(&repo_path), &base_sha).await
}

#[tauri::command]
pub async fn git_rebase_interactive(
    repo_path: String,
    base_sha: String,
    todo: Vec<String>,
    messages: Vec<String>,
) -> Result<OperationResult, GitError> {
    rebase::rebase_interactive(Path::new(&repo_path), &base_sha, todo, messages).await
}

#[tauri::command]
pub async fn git_rebase_continue(repo_path: String) -> Result<(), GitError> {
    rebase::rebase_continue(Path::new(&repo_path)).await
}
