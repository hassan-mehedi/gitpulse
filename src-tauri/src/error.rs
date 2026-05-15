use serde::ser::{SerializeStruct, Serializer};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
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

impl Serialize for GitError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            Self::CommandFailed { args, stderr, code } => {
                let mut state = serializer.serialize_struct("GitError", 4)?;
                state.serialize_field("kind", "commandFailed")?;
                state.serialize_field("args", args)?;
                state.serialize_field("stderr", stderr)?;
                state.serialize_field("code", code)?;
                state.end()
            }
            Self::NotARepo { path } => {
                let mut state = serializer.serialize_struct("GitError", 2)?;
                state.serialize_field("kind", "notARepo")?;
                state.serialize_field("path", path)?;
                state.end()
            }
            Self::MergeConflict { conflicted_files } => {
                let mut state = serializer.serialize_struct("GitError", 2)?;
                state.serialize_field("kind", "mergeConflict")?;
                state.serialize_field("conflictedFiles", conflicted_files)?;
                state.end()
            }
            Self::AuthRequired { remote } => {
                let mut state = serializer.serialize_struct("GitError", 2)?;
                state.serialize_field("kind", "authRequired")?;
                state.serialize_field("remote", remote)?;
                state.end()
            }
            Self::Io(message) => {
                let mut state = serializer.serialize_struct("GitError", 2)?;
                state.serialize_field("kind", "io")?;
                state.serialize_field("message", message)?;
                state.end()
            }
            Self::Parse(message) => {
                let mut state = serializer.serialize_struct("GitError", 2)?;
                state.serialize_field("kind", "parse")?;
                state.serialize_field("message", message)?;
                state.end()
            }
        }
    }
}
