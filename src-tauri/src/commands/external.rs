use std::path::{Path, PathBuf};
use std::process::Command;

use crate::error::GitError;

#[tauri::command]
pub async fn open_file_in_editor(
    repo_path: String,
    file: String,
    line: Option<usize>,
    editor_command: Option<String>,
) -> Result<(), GitError> {
    let path = resolve_file_path(&repo_path, &file);
    tauri::async_runtime::spawn_blocking(move || {
        open_editor(&path, line.unwrap_or(1), editor_command.as_deref())
    })
    .await
    .map_err(|err| GitError::Io(err.to_string()))?
}

#[tauri::command]
pub async fn reveal_file_in_manager(repo_path: String, file: String) -> Result<(), GitError> {
    let path = resolve_file_path(&repo_path, &file);
    tauri::async_runtime::spawn_blocking(move || reveal_file(&path))
        .await
        .map_err(|err| GitError::Io(err.to_string()))?
}

fn resolve_file_path(repo_path: &str, file: &str) -> PathBuf {
    let file_path = Path::new(file);
    if file_path.is_absolute() {
        file_path.to_path_buf()
    } else {
        Path::new(repo_path).join(file_path)
    }
}

fn open_editor(path: &Path, line: usize, editor_command: Option<&str>) -> Result<(), GitError> {
    if let Some(editor) = editor_command.filter(|value| !value.trim().is_empty()) {
        return run_editor_command(editor, path, Some(line))
            .map_err(|err| GitError::Io(err.to_string()));
    }
    if let Ok(editor) = std::env::var("GITPULSE_EDITOR") {
        if !editor.trim().is_empty() {
            return run_editor_command(&editor, path, Some(line))
                .map_err(|err| GitError::Io(err.to_string()));
        }
    }

    let mut line_target = path.as_os_str().to_os_string();
    line_target.push(format!(":{line}"));
    if Command::new("code")
        .arg("-g")
        .arg(&line_target)
        .spawn()
        .is_ok()
    {
        return Ok(());
    }
    if Command::new("code-insiders")
        .arg("-g")
        .arg(&line_target)
        .spawn()
        .is_ok()
    {
        return Ok(());
    }

    if let Ok(editor) = std::env::var("VISUAL").or_else(|_| std::env::var("EDITOR")) {
        if is_gui_editor(&editor) && run_editor_command(&editor, path, None).is_ok() {
            return Ok(());
        }
    }

    open_default(path)
}

fn run_editor_command(
    editor: &str,
    path: &Path,
    line: Option<usize>,
) -> Result<(), std::io::Error> {
    let parts = shell_words::split(editor).unwrap_or_else(|_| {
        editor
            .split_whitespace()
            .map(ToString::to_string)
            .collect()
    });
    let mut iter = parts.into_iter();
    let Some(command) = iter.next() else {
        return Ok(());
    };
    let mut process = Command::new(&command);
    for arg in iter {
        process.arg(arg);
    }
    if supports_code_line_arg(&command) {
        if let Some(line) = line {
            process.arg("-g");
            let mut target = path.as_os_str().to_os_string();
            target.push(format!(":{line}"));
            process.arg(target);
        } else {
            process.arg(path);
        }
    } else {
        process.arg(path);
    }
    process.spawn().map(|_| ())
}

fn supports_code_line_arg(command: &str) -> bool {
    command.ends_with("code") || command.ends_with("code-insiders")
}

fn is_gui_editor(editor: &str) -> bool {
    let parts = shell_words::split(editor).unwrap_or_else(|_| {
        editor
            .split_whitespace()
            .map(ToString::to_string)
            .collect()
    });
    let Some(command) = parts.into_iter().next() else {
        return false;
    };
    let name = Path::new(&command)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(&command)
        .to_ascii_lowercase();
    matches!(
        name.as_str(),
        "code"
            | "code-insiders"
            | "codium"
            | "subl"
            | "zed"
            | "kate"
            | "gedit"
            | "gnome-text-editor"
            | "notepad"
            | "notepad++"
    )
}

#[cfg(target_os = "windows")]
fn reveal_file(path: &Path) -> Result<(), GitError> {
    let arg = format!("/select,{}", path.display());
    Command::new("explorer")
        .arg(arg)
        .spawn()
        .map(|_| ())
        .map_err(|err| GitError::Io(err.to_string()))
}

#[cfg(target_os = "macos")]
fn reveal_file(path: &Path) -> Result<(), GitError> {
    Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|err| GitError::Io(err.to_string()))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn reveal_file(path: &Path) -> Result<(), GitError> {
    let target = path.parent().unwrap_or(path);
    Command::new("xdg-open")
        .arg(target)
        .spawn()
        .map(|_| ())
        .map_err(|err| GitError::Io(err.to_string()))
}

#[cfg(target_os = "windows")]
fn open_default(path: &Path) -> Result<(), GitError> {
    let target = path.display().to_string();
    Command::new("cmd")
        .args(["/C", "start", "", &target])
        .spawn()
        .map(|_| ())
        .map_err(|err| GitError::Io(err.to_string()))
}

#[cfg(target_os = "macos")]
fn open_default(path: &Path) -> Result<(), GitError> {
    Command::new("open")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|err| GitError::Io(err.to_string()))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_default(path: &Path) -> Result<(), GitError> {
    Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|err| GitError::Io(err.to_string()))
}
