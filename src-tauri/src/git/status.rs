use std::path::Path;

use crate::error::GitError;
use crate::git::parser::{parse_diff, parse_diff_stat, parse_status};
use crate::git::runner::GitRunner;
use crate::git::types::{DiffStat, FileDiff, RepoStatus};

pub async fn status(repo_path: &Path) -> Result<RepoStatus, GitError> {
    let output = GitRunner::run(repo_path, &["status", "--porcelain=v2", "--branch"]).await?;
    let stash_output =
        GitRunner::run(repo_path, &["stash", "list", "--format=%gd"]).await.unwrap_or_default();
    let stash_count = stash_output.lines().count();
    parse_status(&output, stash_count)
}

pub async fn diff_file(repo_path: &Path, file: &str, staged: bool) -> Result<FileDiff, GitError> {
    let args = if staged {
        vec!["diff", "--cached", "--", file]
    } else {
        vec!["diff", "--", file]
    };
    let output = GitRunner::run(repo_path, &args).await?;
    parse_diff(&output)
}

pub async fn diff_stat(repo_path: &Path, staged: bool) -> Result<DiffStat, GitError> {
    let args = if staged {
        vec!["diff", "--cached", "--stat"]
    } else {
        vec!["diff", "--stat"]
    };
    let output = GitRunner::run(repo_path, &args).await?;
    Ok(parse_diff_stat(&output))
}
