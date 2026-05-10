use std::path::Path;

use crate::error::GitError;
use crate::git::runner::GitRunner;
use crate::git::types::CherryPickResult;

pub async fn cherry_pick(repo_path: &Path, sha: &str) -> Result<CherryPickResult, GitError> {
    GitRunner::run(repo_path, &["cherry-pick", sha]).await?;
    let head_sha = GitRunner::run(repo_path, &["rev-parse", "HEAD"]).await?;
    let head_sha = head_sha.trim().to_string();

    Ok(CherryPickResult {
        short_sha: head_sha.chars().take(7).collect(),
        sha: head_sha,
        summary: format!("Cherry-picked {sha}"),
    })
}

pub async fn abort(repo_path: &Path) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["cherry-pick", "--abort"]).await?;
    Ok(())
}
