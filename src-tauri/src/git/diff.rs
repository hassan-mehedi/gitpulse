use std::path::Path;
use tokio::process::Command;

use crate::error::GitError;
use crate::git::commit::show_commit_header;
use crate::git::parser::{parse_diff, parse_show_commit};
use crate::git::runner::GitRunner;
use crate::git::types::{CommitDetail, FileDiff};

const EMPTY_TREE_SHA: &str = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

pub async fn show_commit(repo_path: &Path, sha: &str) -> Result<CommitDetail, GitError> {
    let output = show_commit_header(repo_path, sha).await?;
    parse_show_commit(&output)
}

pub async fn commit_diff(
    repo_path: &Path,
    sha: &str,
    parent_index: Option<usize>,
) -> Result<Vec<FileDiff>, GitError> {
    // `rev-list --parents` line is `<sha> <parent1> <parent2> ...`. Skip the
    // commit itself, then pick the requested parent. None / 0 means first
    // parent — matching how non-merge commits are displayed.
    let parents = GitRunner::run(repo_path, &["rev-list", "--parents", "-n", "1", sha]).await?;
    let parent_shas: Vec<&str> = parents.split_whitespace().skip(1).collect();
    let index = parent_index.unwrap_or(0);
    let parent = parent_shas.get(index).copied().or_else(|| parent_shas.first().copied());
    let range = format!("{}..{sha}", parent.unwrap_or(EMPTY_TREE_SHA));
    let output = GitRunner::run(repo_path, &["diff", "--patch", "--find-renames", &range]).await?;
    parse_multi_file_diff(&output)
}

pub async fn diff_refs(repo_path: &Path, from: &str, to: &str) -> Result<Vec<FileDiff>, GitError> {
    let range = format!("{from}..{to}");
    let output = GitRunner::run(repo_path, &["diff", "--patch", "--find-renames", &range]).await?;
    parse_multi_file_diff(&output)
}

pub async fn diff_merge_base(
    repo_path: &Path,
    ref1: &str,
    ref2: &str,
) -> Result<Vec<FileDiff>, GitError> {
    let base = GitRunner::run(repo_path, &["merge-base", ref1, ref2]).await?;
    let base = base.trim().to_string();
    let range = format!("{base}..{ref2}");
    let output = GitRunner::run(repo_path, &["diff", "--patch", "--find-renames", &range]).await?;
    parse_multi_file_diff(&output)
}

pub async fn patch_file(repo_path: &Path, file: &str) -> Result<String, GitError> {
    GitRunner::run(repo_path, &["diff", "--patch", "--", file]).await
}

pub fn parse_multi_file_diff(output: &str) -> Result<Vec<FileDiff>, GitError> {
    let file_diffs = output
        .split("diff --git ")
        .filter(|chunk| !chunk.trim().is_empty())
        .map(|chunk| parse_diff(&format!("diff --git {chunk}")))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(file_diffs)
}

pub async fn file_bytes(
    repo_path: &Path,
    file: &str,
    revision: Option<&str>,
) -> Result<Vec<u8>, GitError> {
    if let Some(revision) = revision {
        let spec = format!("{revision}:{file}");
        let output = Command::new("git")
            .args(["show", &spec])
            .current_dir(repo_path)
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("LC_ALL", "C")
            .output()
            .await
            .map_err(|err| GitError::Io(err.to_string()))?;
        if output.status.success() {
            return Ok(output.stdout);
        }
        return Err(GitError::CommandFailed {
            args: vec!["show".to_string(), spec],
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
            code: output.status.code(),
        });
    }

    let mut path = repo_path.to_path_buf();
    path.push(file);
    std::fs::read(path).map_err(|err| GitError::Io(err.to_string()))
}

pub async fn restore_file(repo_path: &Path, sha: &str, file: &str) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["checkout", sha, "--", file]).await?;
    Ok(())
}
