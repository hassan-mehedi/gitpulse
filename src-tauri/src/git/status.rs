use std::path::Path;

use tokio::process::Command;

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

    if output.trim().is_empty() && !staged {
        if let Some(untracked) = diff_untracked(repo_path, file).await? {
            return parse_diff(&untracked);
        }
    }

    parse_diff(&output)
}

async fn diff_untracked(repo_path: &Path, file: &str) -> Result<Option<String>, GitError> {
    let null_path = if cfg!(windows) { "NUL" } else { "/dev/null" };
    let output = Command::new("git")
        .args(["diff", "--no-index", "--", null_path, file])
        .current_dir(repo_path)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "C")
        .output()
        .await
        .map_err(|err| GitError::Io(err.to_string()))?;

    let code = output.status.code().unwrap_or(0);
    if code != 0 && code != 1 {
        return Ok(None);
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    if stdout.trim().is_empty() {
        Ok(None)
    } else {
        Ok(Some(stdout))
    }
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
