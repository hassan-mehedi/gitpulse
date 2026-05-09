use std::path::Path;

use crate::error::GitError;
use crate::git::graph;
use crate::git::types::{CommitInfo, ReflogEntry};

#[tauri::command]
pub async fn git_graph(
    repo_path: String,
    max_count: Option<usize>,
) -> Result<Vec<CommitInfo>, GitError> {
    graph::graph(Path::new(&repo_path), max_count).await
}

#[tauri::command]
pub async fn git_ref_log(
    repo_path: String,
    n: Option<usize>,
) -> Result<Vec<ReflogEntry>, GitError> {
    graph::ref_log(Path::new(&repo_path), n).await
}
