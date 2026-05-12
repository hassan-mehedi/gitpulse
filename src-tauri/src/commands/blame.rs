use std::path::Path;

use crate::error::GitError;
use crate::git::blame;
use crate::git::types::BlameLine;

#[tauri::command]
pub async fn git_blame(
    repo_path: String,
    file: String,
    ignore_whitespace: Option<bool>,
) -> Result<Vec<BlameLine>, GitError> {
    blame::blame(
        Path::new(&repo_path),
        &file,
        ignore_whitespace.unwrap_or(false),
    )
    .await
}

#[tauri::command]
pub async fn git_blame_line(
    repo_path: String,
    file: String,
    line: usize,
) -> Result<Option<BlameLine>, GitError> {
    blame::blame_line(Path::new(&repo_path), &file, line).await
}
