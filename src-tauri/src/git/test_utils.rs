use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::time::{SystemTime, UNIX_EPOCH};

pub struct TestRepo {
    path: PathBuf,
}

impl TestRepo {
    pub fn new(name: &str) -> Self {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_nanos();
        let path =
            std::env::temp_dir().join(format!("gitpulse-{name}-{}-{unique}", std::process::id()));
        std::fs::create_dir_all(&path).expect("create temp repo dir");
        let repo = Self { path };
        repo.git(&["init", "-b", "main"]);
        repo.git(&["config", "user.name", "GitPulse Test"]);
        repo.git(&["config", "user.email", "gitpulse@example.test"]);
        repo
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn write(&self, relative: &str, content: &str) {
        let path = self.path.join(relative);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).expect("create parent directories");
        }
        std::fs::write(path, content).expect("write test file");
    }

    pub fn commit_all(&self, message: &str) {
        self.git(&["add", "-A"]);
        self.git(&["commit", "-m", message]);
    }

    pub fn git(&self, args: &[&str]) -> Output {
        let output = self.git_output(args);
        assert!(
            output.status.success(),
            "git {:?} failed\nstdout:\n{}\nstderr:\n{}",
            args,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        output
    }

    pub fn git_output(&self, args: &[&str]) -> Output {
        Command::new("git")
            .args(args)
            .current_dir(&self.path)
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("LC_ALL", "C")
            .output()
            .expect("run git command")
    }
}

impl Drop for TestRepo {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.path);
    }
}
