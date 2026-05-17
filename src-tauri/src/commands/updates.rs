use serde::{Deserialize, Serialize};

use crate::error::GitError;

const REPO: &str = "hassan-mehedi/gitpulse";

#[derive(Debug, Serialize)]
pub struct UpdateStatus {
    pub current_version: String,
    pub latest_version: Option<String>,
    pub has_update: bool,
    pub release_url: Option<String>,
    pub release_name: Option<String>,
    pub published_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    name: Option<String>,
    html_url: String,
    published_at: Option<String>,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
}

#[tauri::command]
pub async fn check_for_update() -> Result<UpdateStatus, GitError> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();

    let url = format!("https://api.github.com/repos/{REPO}/releases/latest");
    let response = reqwest::Client::new()
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", format!("GitPulse/{current_version}"))
        .send()
        .await
        .map_err(|err| GitError::Io(format!("GitHub release check failed: {err}")))?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(UpdateStatus {
            current_version,
            latest_version: None,
            has_update: false,
            release_url: None,
            release_name: None,
            published_at: None,
        });
    }

    if !response.status().is_success() {
        return Err(GitError::Io(format!(
            "GitHub returned {} when checking for updates",
            response.status()
        )));
    }

    let release: GithubRelease = response
        .json()
        .await
        .map_err(|err| GitError::Io(format!("Could not parse release JSON: {err}")))?;

    if release.draft || release.prerelease {
        return Ok(UpdateStatus {
            current_version,
            latest_version: None,
            has_update: false,
            release_url: None,
            release_name: None,
            published_at: None,
        });
    }

    let latest = release
        .tag_name
        .strip_prefix("app-v")
        .or_else(|| release.tag_name.strip_prefix('v'))
        .unwrap_or(&release.tag_name)
        .to_string();

    let has_update = is_newer(&latest, &current_version);

    Ok(UpdateStatus {
        current_version,
        latest_version: Some(latest),
        has_update,
        release_url: Some(release.html_url),
        release_name: release.name,
        published_at: release.published_at,
    })
}

fn is_newer(candidate: &str, current: &str) -> bool {
    let parse = |s: &str| -> Vec<u32> {
        s.split('.')
            .map(|chunk| chunk.chars().take_while(|c| c.is_ascii_digit()).collect::<String>())
            .map(|n| n.parse().unwrap_or(0))
            .collect()
    };
    let mut a = parse(candidate);
    let mut b = parse(current);
    while a.len() < b.len() {
        a.push(0);
    }
    while b.len() < a.len() {
        b.push(0);
    }
    a > b
}

#[cfg(test)]
mod tests {
    use super::is_newer;

    #[test]
    fn detects_patch_bump() {
        assert!(is_newer("0.1.2", "0.1.1"));
    }

    #[test]
    fn detects_minor_bump() {
        assert!(is_newer("0.2.0", "0.1.9"));
    }

    #[test]
    fn detects_major_bump() {
        assert!(is_newer("1.0.0", "0.9.99"));
    }

    #[test]
    fn rejects_same_version() {
        assert!(!is_newer("0.1.0", "0.1.0"));
    }

    #[test]
    fn rejects_older() {
        assert!(!is_newer("0.0.9", "0.1.0"));
    }

    #[test]
    fn handles_uneven_segment_counts() {
        assert!(is_newer("0.2", "0.1.9"));
        assert!(!is_newer("0.1", "0.1.1"));
    }
}
