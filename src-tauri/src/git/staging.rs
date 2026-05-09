use std::path::Path;

use crate::error::GitError;
use crate::git::runner::GitRunner;

pub async fn stage_file(repo_path: &Path, file: &str) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["add", "--", file]).await?;
    Ok(())
}

pub async fn stage_files(repo_path: &Path, files: &[String]) -> Result<(), GitError> {
    let mut args = vec!["add", "--"];
    for file in files {
        args.push(file.as_str());
    }
    GitRunner::run(repo_path, &args).await?;
    Ok(())
}

pub async fn stage_all(repo_path: &Path) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["add", "-A"]).await?;
    Ok(())
}

pub async fn stage_dir(repo_path: &Path, dir: &str) -> Result<(), GitError> {
    let target = format!("{dir}/");
    GitRunner::run(repo_path, &["add", "--", &target]).await?;
    Ok(())
}

pub async fn stage_lines(repo_path: &Path, patch: &str) -> Result<(), GitError> {
    GitRunner::run_with_input(repo_path, &["apply", "--cached", "--unidiff-zero", "-"], patch)
        .await?;
    Ok(())
}

pub async fn unstage_file(repo_path: &Path, file: &str) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["reset", "HEAD", "--", file]).await?;
    Ok(())
}

pub async fn unstage_all(repo_path: &Path) -> Result<(), GitError> {
    GitRunner::run(repo_path, &["reset", "HEAD"]).await?;
    Ok(())
}

pub async fn unstage_lines(repo_path: &Path, patch: &str) -> Result<(), GitError> {
    GitRunner::run_with_input(
        repo_path,
        &["apply", "--cached", "--reverse", "--unidiff-zero", "-"],
        patch,
    )
    .await?;
    Ok(())
}
