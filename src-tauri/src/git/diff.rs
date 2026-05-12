use std::path::Path;

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

pub async fn commit_diff(repo_path: &Path, sha: &str) -> Result<Vec<FileDiff>, GitError> {
    let parents = GitRunner::run(repo_path, &["rev-list", "--parents", "-n", "1", sha]).await?;
    let parent = parents.split_whitespace().nth(1);
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

pub fn parse_multi_file_diff(output: &str) -> Result<Vec<FileDiff>, GitError> {
    let file_diffs = output
        .split("diff --git ")
        .filter(|chunk| !chunk.trim().is_empty())
        .map(|chunk| parse_diff(&format!("diff --git {chunk}")))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(file_diffs)
}
