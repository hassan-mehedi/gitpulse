use std::path::Path;

use crate::error::GitError;
use crate::git::parser::parse_worktrees;
use crate::git::runner::GitRunner;
use crate::git::types::{OperationResult, WorktreeInfo};

pub async fn list(repo_path: &Path) -> Result<Vec<WorktreeInfo>, GitError> {
    let repo_path = repo_path.canonicalize()?;
    let repo_path = repo_path.display().to_string();
    let output =
        GitRunner::run(Path::new(&repo_path), &["worktree", "list", "--porcelain"]).await?;
    Ok(parse_worktrees(&output, &repo_path))
}

pub async fn add(
    repo_path: &Path,
    path: &str,
    branch: Option<&str>,
) -> Result<WorktreeInfo, GitError> {
    let mut args = vec!["worktree", "add", path];
    if let Some(branch) = branch {
        args.push(branch);
    }

    GitRunner::run(repo_path, &args).await?;

    // Canonicalize after creation so the path actually exists on disk.
    let expected_path = Path::new(path)
        .canonicalize()
        .ok()
        .map(|value| value.display().to_string())
        .unwrap_or_else(|| path.to_string());

    let worktrees = list(repo_path).await?;
    worktrees
        .into_iter()
        .find(|worktree| worktree.path == expected_path)
        .ok_or_else(|| {
            GitError::Parse(format!(
                "unable to locate created worktree at {expected_path}"
            ))
        })
}

pub async fn remove(repo_path: &Path, path: &str) -> Result<OperationResult, GitError> {
    GitRunner::run(repo_path, &["worktree", "remove", path]).await?;
    Ok(OperationResult {
        summary: format!("Removed worktree {path}"),
    })
}

pub async fn prune(repo_path: &Path) -> Result<OperationResult, GitError> {
    GitRunner::run(repo_path, &["worktree", "prune"]).await?;
    Ok(OperationResult {
        summary: "Pruned stale worktrees".to_string(),
    })
}
