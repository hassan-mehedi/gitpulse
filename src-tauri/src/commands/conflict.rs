use std::path::Path;

use crate::error::GitError;
use crate::git::conflict;
use crate::git::types::ConflictContent;

#[tauri::command]
pub async fn git_list_conflicts(repo_path: String) -> Result<Vec<String>, GitError> {
    conflict::list(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_get_conflict_content(
    repo_path: String,
    file: String,
) -> Result<ConflictContent, GitError> {
    conflict::content(Path::new(&repo_path), &file).await
}

#[tauri::command]
pub async fn git_mark_resolved(repo_path: String, file: String) -> Result<(), GitError> {
    conflict::mark_resolved(Path::new(&repo_path), &file).await
}

#[tauri::command]
pub async fn git_set_conflict_content(
    repo_path: String,
    file: String,
    content: String,
) -> Result<(), GitError> {
    conflict::set_content(Path::new(&repo_path), &file, &content).await
}

#[tauri::command]
pub async fn git_continue_merge(repo_path: String) -> Result<(), GitError> {
    conflict::continue_merge(Path::new(&repo_path)).await
}
