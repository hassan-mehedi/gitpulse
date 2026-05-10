use std::path::Path;

use crate::error::GitError;
use crate::git::runner::GitRunner;
use crate::git::types::ConflictContent;

pub async fn list(repo_path: &Path) -> Result<Vec<String>, GitError> {
    let output = GitRunner::run(repo_path, &["diff", "--name-only", "--diff-filter=U"]).await?;
    Ok(output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToString::to_string)
        .collect())
}

pub async fn content(repo_path: &Path, file: &str) -> Result<ConflictContent, GitError> {
    let raw = std::fs::read_to_string(repo_path.join(file))?;
    let base = show_stage(repo_path, 1, file).await?;
    let ours = show_stage(repo_path, 2, file).await?;
    let theirs = show_stage(repo_path, 3, file).await?;

    Ok(ConflictContent {
        base,
        ours,
        theirs,
        raw,
    })
}

pub async fn mark_resolved(repo_path: &Path, file: &str) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["add", "--", file]).await?;
    Ok(())
}

pub async fn set_content(repo_path: &Path, file: &str, content: &str) -> Result<(), GitError> {
    let path = repo_path.join(file);
    std::fs::write(path, content)?;
    Ok(())
}

pub async fn continue_merge(repo_path: &Path) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["merge", "--continue"]).await?;
    Ok(())
}

async fn show_stage(repo_path: &Path, stage: usize, file: &str) -> Result<String, GitError> {
    let stage_ref = format!(":{stage}:{file}");
    match GitRunner::run(repo_path, &["show", &stage_ref]).await {
        Ok(content) => Ok(content),
        Err(GitError::CommandFailed { code: Some(128), .. }) => Ok(String::new()),
        Err(error) => Err(error),
    }
}
