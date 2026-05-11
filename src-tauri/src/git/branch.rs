use std::path::Path;

use crate::error::GitError;
use crate::git::parser::parse_branches;
use crate::git::runner::GitRunner;
use crate::git::types::{BranchInfo, OperationResult};

pub async fn branches(repo_path: &Path) -> Result<Vec<BranchInfo>, GitError> {
    // %(refname) gives the FULL ref (`refs/heads/<name>` or `refs/remotes/<name>`)
    // so we can reliably classify local vs. remote branches. `%(refname:short)`
    // strips both prefixes, losing the local/remote distinction.
    let format = "%(refname)%x1f%(HEAD)%x1f%(upstream:short)%x1f%(objectname)%x1f%(committerdate:iso8601)";
    let output = GitRunner::run(repo_path, &["branch", "-a", "--format", format]).await?;
    Ok(parse_branches(&output))
}

pub async fn current_branch(repo_path: &Path) -> Result<String, GitError> {
    let output = GitRunner::run(repo_path, &["symbolic-ref", "--short", "HEAD"]).await?;
    Ok(output.trim().to_string())
}

pub async fn create_branch(
    repo_path: &Path,
    name: &str,
    source: Option<&str>,
) -> Result<(), GitError> {
    let args = if let Some(source) = source {
        vec!["checkout", "-b", name, source]
    } else {
        vec!["checkout", "-b", name]
    };
    GitRunner::run(repo_path, &args).await?;
    Ok(())
}

pub async fn switch_branch(repo_path: &Path, name: &str) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["checkout", name]).await?;
    Ok(())
}

pub async fn rename_branch(repo_path: &Path, old: &str, new: &str) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["branch", "-m", old, new]).await?;
    Ok(())
}

pub async fn delete_branch(repo_path: &Path, name: &str, force: bool) -> Result<(), GitError> {
    let flag = if force { "-D" } else { "-d" };
    GitRunner::run(repo_path, &["branch", flag, name]).await?;
    Ok(())
}

pub async fn merge(repo_path: &Path, branch: &str) -> Result<OperationResult, GitError> {
    GitRunner::run(repo_path, &["merge", branch]).await?;
    Ok(OperationResult {
        summary: format!("Merged {branch}"),
    })
}

pub async fn rebase(repo_path: &Path, onto: &str) -> Result<OperationResult, GitError> {
    GitRunner::run(repo_path, &["rebase", onto]).await?;
    Ok(OperationResult {
        summary: format!("Rebased onto {onto}"),
    })
}

pub async fn abort_merge(repo_path: &Path) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["merge", "--abort"]).await?;
    Ok(())
}

pub async fn abort_rebase(repo_path: &Path) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["rebase", "--abort"]).await?;
    Ok(())
}

pub async fn delete_remote_branch(
    repo_path: &Path,
    remote: &str,
    branch: &str,
) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["push", remote, "--delete", branch]).await?;
    Ok(())
}
