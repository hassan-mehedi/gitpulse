use std::path::Path;

use serde::Deserialize;

use crate::error::GitError;
use crate::git::types::Repository;
use crate::workspace::manager::{is_git_repo, scan_repo};

#[derive(Debug, Deserialize)]
pub struct CodeWorkspace {
    pub folders: Vec<WorkspaceFolder>,
}

#[derive(Debug, Deserialize)]
pub struct WorkspaceFolder {
    pub path: String,
}

pub async fn open_workspace_file(file_path: &Path) -> Result<Vec<Repository>, GitError> {
    let workspace_dir = file_path.parent().ok_or_else(|| GitError::Io("workspace file has no parent directory".to_string()))?;
    let content = tokio::fs::read_to_string(file_path).await?;
    let workspace: CodeWorkspace = serde_json::from_str(&content)?;

    let mut repositories = Vec::new();
    for folder in workspace.folders {
        let abs_path = workspace_dir.join(&folder.path).canonicalize()?;
        if is_git_repo(&abs_path).await {
            repositories.push(scan_repo(&abs_path).await?);
        }
    }

    Ok(repositories)
}
