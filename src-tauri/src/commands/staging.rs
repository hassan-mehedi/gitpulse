use std::path::Path;

use crate::error::GitError;
use crate::git::staging;

#[tauri::command]
pub async fn git_stage_file(repo_path: String, file: String) -> Result<(), GitError> {
    staging::stage_file(Path::new(&repo_path), &file).await
}

#[tauri::command]
pub async fn git_stage_files(repo_path: String, files: Vec<String>) -> Result<(), GitError> {
    staging::stage_files(Path::new(&repo_path), &files).await
}

#[tauri::command]
pub async fn git_stage_all(repo_path: String) -> Result<(), GitError> {
    staging::stage_all(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_stage_dir(repo_path: String, dir: String) -> Result<(), GitError> {
    staging::stage_dir(Path::new(&repo_path), &dir).await
}

#[tauri::command]
pub async fn git_stage_lines(repo_path: String, file: String, patch: String) -> Result<(), GitError> {
    let _ = file;
    staging::stage_lines(Path::new(&repo_path), &patch).await
}

#[tauri::command]
pub async fn git_unstage_file(repo_path: String, file: String) -> Result<(), GitError> {
    staging::unstage_file(Path::new(&repo_path), &file).await
}

#[tauri::command]
pub async fn git_unstage_all(repo_path: String) -> Result<(), GitError> {
    staging::unstage_all(Path::new(&repo_path)).await
}

#[tauri::command]
pub async fn git_unstage_lines(repo_path: String, file: String, patch: String) -> Result<(), GitError> {
    let _ = file;
    staging::unstage_lines(Path::new(&repo_path), &patch).await
}
