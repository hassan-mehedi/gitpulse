use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum GitError {
    #[error("Git command failed: {stderr}")]
    CommandFailed {
        args: Vec<String>,
        stderr: String,
        code: Option<i32>,
    },

    #[error("Not a git repository: {path}")]
    NotARepo { path: String },

    #[error("Merge conflict detected")]
    MergeConflict { conflicted_files: Vec<String> },

    #[error("Authentication required")]
    AuthRequired { remote: String },

    #[error("IO error: {0}")]
    Io(String),

    #[error("Parse error: {0}")]
    Parse(String),
}

impl From<std::io::Error> for GitError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value.to_string())
    }
}

impl From<serde_json::Error> for GitError {
    fn from(value: serde_json::Error) -> Self {
        Self::Parse(value.to_string())
    }
}
