use std::path::Path;

use tauri::{AppHandle, Emitter, Runtime};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::Command;

use crate::error::GitError;
use crate::git::types::ProgressPayload;

pub struct GitRunner;

impl GitRunner {
    pub async fn run(repo_path: &Path, args: &[&str]) -> Result<String, GitError> {
        let output = Command::new("git")
            .args(args)
            .current_dir(repo_path)
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("LC_ALL", "C")
            .output()
            .await?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            if stderr.contains("Authentication failed") || stderr.contains("could not read Username")
            {
                return Err(GitError::AuthRequired {
                    remote: repo_path.display().to_string(),
                });
            }

            Err(GitError::CommandFailed {
                args: args.iter().map(|arg| (*arg).to_string()).collect(),
                stderr,
                code: output.status.code(),
            })
        }
    }

    pub async fn run_with_input(
        repo_path: &Path,
        args: &[&str],
        input: &str,
    ) -> Result<String, GitError> {
        use tokio::io::AsyncWriteExt;
        use tokio::process::Command;

        let mut child = Command::new("git")
            .args(args)
            .current_dir(repo_path)
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("LC_ALL", "C")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(input.as_bytes()).await?;
        }

        let output = child.wait_with_output().await?;
        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            Err(GitError::CommandFailed {
                args: args.iter().map(|arg| (*arg).to_string()).collect(),
                stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
                code: output.status.code(),
            })
        }
    }

    pub async fn version() -> Result<String, GitError> {
        let output = Command::new("git")
            .arg("--version")
            .env("LC_ALL", "C")
            .output()
            .await?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(GitError::CommandFailed {
                args: vec!["--version".to_string()],
                stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
                code: output.status.code(),
            })
        }
    }

    pub async fn run_with_progress<R: Runtime>(
        app_handle: &AppHandle<R>,
        repo_path: &Path,
        operation: &str,
        args: &[&str],
    ) -> Result<String, GitError> {
        let payload = ProgressPayload {
            repo_path: repo_path.display().to_string(),
            operation: operation.to_string(),
            message: "Started".to_string(),
            percent: None,
            status: "started".to_string(),
        };
        let _ = app_handle.emit("git:progress", payload);

        let mut child = Command::new("git")
            .args(args)
            .current_dir(repo_path)
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("LC_ALL", "C")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| GitError::Io("failed to capture git stdout".to_string()))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| GitError::Io("failed to capture git stderr".to_string()))?;

        let stdout_task = tokio::spawn(async move {
            let mut stdout = stdout;
            let mut buffer = Vec::new();
            stdout.read_to_end(&mut buffer).await.map(|_| buffer)
        });

        let app_handle_for_stderr = app_handle.clone();
        let repo_path_for_stderr = repo_path.display().to_string();
        let operation_for_stderr = operation.to_string();
        let stderr_task = tokio::spawn(async move {
            let mut stderr_lines = BufReader::new(stderr).lines();
            let mut stderr_output = String::new();
            while let Some(line) = stderr_lines.next_line().await? {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                if !stderr_output.is_empty() {
                    stderr_output.push('\n');
                }
                stderr_output.push_str(trimmed);
                let _ = app_handle_for_stderr.emit(
                    "git:progress",
                    ProgressPayload {
                        repo_path: repo_path_for_stderr.clone(),
                        operation: operation_for_stderr.clone(),
                        message: trimmed.to_string(),
                        percent: extract_percent(trimmed),
                        status: "running".to_string(),
                    },
                );
            }

            Ok::<String, std::io::Error>(stderr_output)
        });

        let status = child.wait().await?;
        let stdout_output = stdout_task
            .await
            .map_err(|err| GitError::Io(err.to_string()))??;
        let stderr_output = stderr_task
            .await
            .map_err(|err| GitError::Io(err.to_string()))??;
        let stdout_output = String::from_utf8_lossy(&stdout_output).to_string();

        if status.success() {
            let _ = app_handle.emit(
                "git:progress",
                ProgressPayload {
                    repo_path: repo_path.display().to_string(),
                    operation: operation.to_string(),
                    message: "Completed".to_string(),
                    percent: Some(100),
                    status: "completed".to_string(),
                },
            );
            Ok(stdout_output)
        } else {
            let _ = app_handle.emit(
                "git:progress",
                ProgressPayload {
                    repo_path: repo_path.display().to_string(),
                    operation: operation.to_string(),
                    message: if stderr_output.is_empty() {
                        "Failed".to_string()
                    } else {
                        stderr_output.clone()
                    },
                    percent: None,
                    status: "failed".to_string(),
                },
            );

            if stderr_output.contains("Authentication failed")
                || stderr_output.contains("could not read Username")
            {
                return Err(GitError::AuthRequired {
                    remote: repo_path.display().to_string(),
                });
            }

            Err(GitError::CommandFailed {
                args: args.iter().map(|arg| (*arg).to_string()).collect(),
                stderr: stderr_output,
                code: status.code(),
            })
        }
    }
}

fn extract_percent(line: &str) -> Option<u8> {
    let percent_index = line.find('%')?;
    let digits = line[..percent_index]
        .chars()
        .rev()
        .take_while(|char| char.is_ascii_digit())
        .collect::<Vec<_>>();
    if digits.is_empty() {
        return None;
    }

    let number = digits.into_iter().rev().collect::<String>().parse().ok()?;
    Some(number)
}
