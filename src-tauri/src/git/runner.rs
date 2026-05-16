use std::path::Path;

use tauri::{AppHandle, Emitter, Runtime};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::Command;

use crate::error::GitError;
use crate::git::types::ProgressPayload;

fn emit_output(repo_path: &Path, args: &[&str], message: String, status: &str) {
    let payload = ProgressPayload {
        repo_path: repo_path.display().to_string(),
        operation: args.first().copied().unwrap_or("git").to_string(),
        command: redact_args(args),
        message: redact_secrets(&message),
        percent: if status == "completed" {
            Some(100)
        } else {
            None
        },
        status: status.to_string(),
    };
    let _ = tauri::async_runtime::spawn_blocking(move || {
        println!(
            "gitpulse-output:{}",
            serde_json::to_string(&payload).unwrap_or_default()
        );
    });
}

pub struct GitRunner;

impl GitRunner {
    pub async fn run(repo_path: &Path, args: &[&str]) -> Result<String, GitError> {
        emit_output(repo_path, args, "Started".to_string(), "started");
        let output = Command::new("git")
            .args(args)
            .current_dir(repo_path)
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("LC_ALL", "C")
            .output()
            .await?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            emit_output(
                repo_path,
                args,
                if stdout.trim().is_empty() {
                    "Completed".to_string()
                } else {
                    stdout.trim().to_string()
                },
                "completed",
            );
            Ok(stdout)
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            emit_output(repo_path, args, stderr.clone(), "failed");
            if stderr.contains("Authentication failed")
                || stderr.contains("could not read Username")
            {
                return Err(GitError::AuthRequired {
                    remote: repo_path.display().to_string(),
                });
            }

            Err(GitError::CommandFailed {
                args: redact_args(args),
                stderr: redact_secrets(&stderr),
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

        emit_output(repo_path, args, "Started".to_string(), "started");
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
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            emit_output(
                repo_path,
                args,
                if stdout.trim().is_empty() {
                    "Completed".to_string()
                } else {
                    stdout.trim().to_string()
                },
                "completed",
            );
            Ok(stdout)
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            emit_output(repo_path, args, stderr.clone(), "failed");
            Err(GitError::CommandFailed {
                args: redact_args(args),
                stderr: redact_secrets(&stderr),
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
            command: redact_args(args),
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
                        command: Vec::new(),
                        message: redact_secrets(trimmed),
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
                    command: redact_args(args),
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
                    command: redact_args(args),
                    message: if stderr_output.is_empty() {
                        "Failed".to_string()
                    } else {
                        redact_secrets(&stderr_output)
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
                args: redact_args(args),
                stderr: redact_secrets(&stderr_output),
                code: status.code(),
            })
        }
    }
}

fn redact_args(args: &[&str]) -> Vec<String> {
    args.iter().map(|arg| redact_secrets(arg)).collect()
}

fn redact_secrets(value: &str) -> String {
    let mut output = value.to_string();
    for scheme in ["https://", "http://", "ssh://"] {
        output = redact_url_credentials(output, scheme);
    }
    output
}

fn redact_url_credentials(mut value: String, scheme: &str) -> String {
    let mut search_start = 0;
    while let Some(relative_scheme_start) = value[search_start..].find(scheme) {
        let scheme_start = search_start + relative_scheme_start;
        let credentials_start = scheme_start + scheme.len();
        let segment_end = value[credentials_start..]
            .find(|char: char| char.is_whitespace() || matches!(char, '/' | '\'' | '"' | ')' | '('))
            .map(|relative_end| credentials_start + relative_end)
            .unwrap_or(value.len());

        let Some(relative_at) = value[credentials_start..segment_end].rfind('@') else {
            search_start = credentials_start;
            continue;
        };

        let at = credentials_start + relative_at;
        value.replace_range(credentials_start..at, "****");
        search_start = credentials_start + "****@".len();
    }
    value
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

#[cfg(test)]
mod tests {
    use super::redact_secrets;

    #[test]
    fn redacts_url_credentials_without_touching_public_urls() {
        assert_eq!(
            redact_secrets("https://user:token@example.com/org/repo.git"),
            "https://****@example.com/org/repo.git"
        );
        assert_eq!(
            redact_secrets("ssh://git:secret@example.com/repo.git"),
            "ssh://****@example.com/repo.git"
        );
        assert_eq!(
            redact_secrets("https://example.com/org/repo.git"),
            "https://example.com/org/repo.git"
        );
    }

    #[test]
    fn redacts_multiple_urls_in_one_message() {
        assert_eq!(
            redact_secrets("push https://user:one@example.com/a then http://token@example.com/b"),
            "push https://****@example.com/a then http://****@example.com/b"
        );
    }
}
