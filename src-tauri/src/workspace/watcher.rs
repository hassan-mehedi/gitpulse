use std::path::{Path, PathBuf};
use std::time::Duration;

use notify_debouncer_full::notify::RecursiveMode;
use notify_debouncer_full::{new_debouncer, DebouncedEvent, Debouncer, RecommendedCache};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};

use crate::error::GitError;

pub type RepoDebouncer =
    Debouncer<notify_debouncer_full::notify::RecommendedWatcher, RecommendedCache>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoEventPayload {
    pub repo_path: String,
}

pub fn create_watchers<R: Runtime>(
    app_handle: &AppHandle<R>,
    repo_paths: &[String],
) -> Result<Vec<RepoDebouncer>, GitError> {
    let mut watchers = Vec::new();

    for repo_path in repo_paths {
        let repo_root = PathBuf::from(repo_path);
        let repo_root_for_events = repo_root.clone();
        let app_handle = app_handle.clone();
        let mut debouncer = new_debouncer(
            Duration::from_millis(300),
            None,
            move |events: Result<Vec<DebouncedEvent>, Vec<notify_debouncer_full::notify::Error>>| {
                if let Ok(events) = events {
                    for event in events {
                        emit_repo_event(&app_handle, &repo_root_for_events, &event);
                    }
                }
            },
        )
        .map_err(|err| GitError::Io(err.to_string()))?;

        debouncer
            .watch(&repo_root, RecursiveMode::Recursive)
            .map_err(|err| GitError::Io(err.to_string()))?;
        watchers.push(debouncer);
    }

    Ok(watchers)
}

fn emit_repo_event<R: Runtime>(
    app_handle: &AppHandle<R>,
    repo_root: &Path,
    event: &DebouncedEvent,
) {
    if is_ignored_event(event) {
        return;
    }

    let payload = RepoEventPayload {
        repo_path: repo_root.display().to_string(),
    };

    let event_name = if touches_head(event) {
        "repo:head-changed"
    } else if touches_remote_refs(event) {
        "repo:remotes-changed"
    } else {
        "repo:status-changed"
    };

    let _ = app_handle.emit(event_name, payload);
}

fn is_ignored_event(event: &DebouncedEvent) -> bool {
    event.paths.iter().any(|path| {
        let path = path.to_string_lossy();
        path.contains("/.git/objects/") || path.contains("/.git/logs/")
    })
}

fn touches_head(event: &DebouncedEvent) -> bool {
    event
        .paths
        .iter()
        .any(|path| path.to_string_lossy().ends_with("/.git/HEAD"))
}

fn touches_remote_refs(event: &DebouncedEvent) -> bool {
    event
        .paths
        .iter()
        .any(|path| path.to_string_lossy().contains("/.git/refs/remotes/"))
}
