use std::path::Path;

use crate::error::GitError;
use crate::git::runner::GitRunner;

#[tauri::command]
pub async fn git_discard_file(repo_path: String, file: String) -> Result<(), GitError> {
    GitRunner::run(Path::new(&repo_path), &["checkout", "--", &file]).await?;
    Ok(())
}

#[tauri::command]
pub async fn git_discard_all(repo_path: String) -> Result<(), GitError> {
    GitRunner::run(Path::new(&repo_path), &["checkout", "--", "."]).await?;
    Ok(())
}

#[tauri::command]
pub async fn git_discard_lines(
    repo_path: String,
    file: String,
    patch: String,
) -> Result<(), GitError> {
    let _ = file;
    GitRunner::run_with_input(
        Path::new(&repo_path),
        &["apply", "--reverse", "--unidiff-zero", "-"],
        &patch,
    )
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn git_clean_untracked(repo_path: String, paths: Vec<String>) -> Result<(), GitError> {
    let mut args = vec!["clean", "-fd", "--"];
    for path in &paths {
        args.push(path);
    }
    GitRunner::run(Path::new(&repo_path), &args).await?;
    Ok(())
}
