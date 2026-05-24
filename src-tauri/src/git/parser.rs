use crate::error::GitError;
use crate::git::types::{
    BlameLine, BranchInfo, CommitDetail, CommitFileStat, CommitInfo, CommitResult, DiffHunk,
    DiffLine, DiffStat, DiffStatEntry, FileChange, FileDiff, ReflogEntry, RemoteInfo, RepoStatus,
    StashEntry, TagInfo, WorktreeInfo,
};

pub fn parse_status(output: &str, stash_count: usize) -> Result<RepoStatus, GitError> {
    let mut branch = "HEAD".to_string();
    let mut head_sha = String::new();
    let mut upstream = None;
    let mut ahead = 0;
    let mut behind = 0;
    let mut changes = Vec::new();
    let mut staged = Vec::new();
    let mut has_conflicts = false;

    for line in output.lines() {
        if let Some(rest) = line.strip_prefix("# branch.head ") {
            branch = rest.to_string();
            continue;
        }

        if let Some(rest) = line.strip_prefix("# branch.oid ") {
            head_sha = rest.to_string();
            continue;
        }

        if let Some(rest) = line.strip_prefix("# branch.upstream ") {
            upstream = Some(rest.to_string());
            continue;
        }

        if let Some(rest) = line.strip_prefix("# branch.ab +") {
            let mut parts = rest.split(" -");
            ahead = parts.next().unwrap_or("0").parse().unwrap_or(0);
            behind = parts.next().unwrap_or("0").parse().unwrap_or(0);
            continue;
        }

        if line.starts_with("1 ") || line.starts_with("2 ") || line.starts_with("u ") {
            let Some((xy, path, old_path)) = parse_status_record(line) else {
                continue;
            };

            let index_status = xy.chars().next().unwrap_or('.');
            let worktree_status = xy.chars().nth(1).unwrap_or('.');

            // Unmerged paths have no stage-0 blob — staging concepts don't
            // apply. Surface them ONLY in `changes` with status "U" so the
            // UI's Merge Changes section is the single source of truth.
            // Treating them as "also staged" duplicates the row into the
            // Staged Changes section and confuses the resolve flow.
            if line.starts_with("u ") || index_status == 'U' || worktree_status == 'U' {
                has_conflicts = true;
                changes.push(FileChange {
                    path,
                    old_path,
                    status: "U".to_string(),
                    staged: false,
                });
                continue;
            }

            if index_status != '.' {
                staged.push(FileChange {
                    path: path.clone(),
                    old_path: old_path.clone(),
                    status: index_status.to_string(),
                    staged: true,
                });
            }

            if worktree_status != '.' {
                changes.push(FileChange {
                    path,
                    old_path,
                    status: worktree_status.to_string(),
                    staged: false,
                });
            }
        } else if let Some(path) = line.strip_prefix("? ") {
            changes.push(FileChange {
                path: path.to_string(),
                old_path: None,
                status: "?".to_string(),
                staged: false,
            });
        }
    }

    Ok(RepoStatus {
        branch,
        head_sha,
        upstream,
        ahead,
        behind,
        changes,
        staged,
        stash_count,
        has_conflicts,
    })
}

fn parse_status_record(line: &str) -> Option<(&str, String, Option<String>)> {
    if line.starts_with("1 ") {
        let parts = line.splitn(9, ' ').collect::<Vec<_>>();
        return Some((parts.get(1)?, parts.get(8)?.to_string(), None));
    }

    if line.starts_with("2 ") {
        let parts = line.splitn(10, ' ').collect::<Vec<_>>();
        let (path, old_path) = parts.get(9)?.split_once('\t')?;
        return Some((parts.get(1)?, path.to_string(), Some(old_path.to_string())));
    }

    if line.starts_with("u ") {
        let parts = line.splitn(11, ' ').collect::<Vec<_>>();
        return Some((parts.get(1)?, parts.get(10)?.to_string(), None));
    }

    None
}

#[cfg(test)]
mod status_tests {
    use super::parse_status;

    #[test]
    fn preserves_spaces_in_regular_paths() {
        let status = parse_status(
            "# branch.head main\n1 .M N... 100644 100644 100644 abc abc docs/my file.md",
            0,
        )
        .expect("status should parse");

        assert_eq!(status.changes[0].path, "docs/my file.md");
    }

    #[test]
    fn preserves_spaces_in_rename_paths() {
        let status = parse_status(
            "# branch.head main\n2 R. N... 100644 100644 100644 abc def R100 docs/new file.md\tdocs/old file.md",
            0,
        )
        .expect("status should parse");

        assert_eq!(status.staged[0].path, "docs/new file.md");
        assert_eq!(
            status.staged[0].old_path.as_deref(),
            Some("docs/old file.md")
        );
    }

    #[test]
    fn preserves_spaces_in_unmerged_paths() {
        let status = parse_status(
            "# branch.head main\nu UU N... 100644 100644 100644 100644 abc def ghi conflicted file.md",
            0,
        )
        .expect("status should parse");

        assert_eq!(status.changes[0].path, "conflicted file.md");
        assert!(status.has_conflicts);
    }

    #[test]
    fn unmerged_paths_only_appear_in_changes_not_staged() {
        // u UU records used to double-up into both `staged` and `changes`,
        // which surfaced the conflicted file in the SCM panel's Staged
        // Changes section as well as Merge Changes. Unmerged paths have
        // no stage-0 blob, so "staged" is meaningless for them.
        let status = parse_status(
            "# branch.head main\nu UU N... 100644 100644 100644 100644 abc def ghi list.ts",
            0,
        )
        .expect("status should parse");

        assert!(
            status.staged.is_empty(),
            "unmerged file should not appear in staged: {:?}",
            status.staged
        );
        assert_eq!(status.changes.len(), 1);
        assert_eq!(status.changes[0].path, "list.ts");
        assert_eq!(status.changes[0].status, "U");
        assert!(status.has_conflicts);
    }

    #[test]
    fn unmerged_alongside_normal_staged_file_keeps_each_in_one_bucket() {
        let status = parse_status(
            "# branch.head main\n\
             1 M. N... 100644 100644 100644 abc def src/keep.ts\n\
             u UU N... 100644 100644 100644 100644 abc def ghi src/conflict.ts",
            0,
        )
        .expect("status should parse");

        assert_eq!(status.staged.len(), 1);
        assert_eq!(status.staged[0].path, "src/keep.ts");
        assert_eq!(status.changes.len(), 1);
        assert_eq!(status.changes[0].path, "src/conflict.ts");
        assert_eq!(status.changes[0].status, "U");
        assert!(status.has_conflicts);
    }
}

pub fn parse_diff(output: &str) -> Result<FileDiff, GitError> {
    let mut file = String::new();
    let mut old_file = None;
    let mut status = None;
    let mut hunks = Vec::new();
    let mut current_hunk: Option<DiffHunk> = None;
    let mut old_lineno = 0usize;
    let mut new_lineno = 0usize;
    let mut is_binary = false;

    for line in output.lines() {
        // `git diff` on an unmerged path emits a combined diff (`diff --cc`
        // or `diff --combined`) with multi-parent `@@@` hunk headers. We
        // can't render that as a unified diff, so skip the body — callers
        // should route conflicts to the merge editor instead.
        if line.starts_with("diff --cc ") || line.starts_with("diff --combined ") {
            return Ok(FileDiff {
                file: line
                    .splitn(3, ' ')
                    .nth(2)
                    .unwrap_or_default()
                    .to_string(),
                old_file: None,
                status: Some("U".to_string()),
                hunks: Vec::new(),
                is_binary: false,
            });
        }

        if let Some(rest) = line.strip_prefix("diff --git a/") {
            if let Some(hunk) = current_hunk.take() {
                hunks.push(hunk);
            }
            if let Some((old, new)) = rest.rsplit_once(" b/") {
                old_file = Some(old.to_string());
                file = new.to_string();
            }
            continue;
        }

        if line.starts_with("Binary files ") {
            is_binary = true;
            continue;
        }

        if line.starts_with("new file mode ") {
            status = Some("A".to_string());
            continue;
        }

        if line.starts_with("deleted file mode ") {
            status = Some("D".to_string());
            continue;
        }

        if line.starts_with("rename from ") {
            status = Some("R".to_string());
            continue;
        }

        if line.starts_with("copy from ") {
            status = Some("C".to_string());
            continue;
        }

        if line.starts_with("@@") {
            if let Some(hunk) = current_hunk.take() {
                hunks.push(hunk);
            }

            let (old_start, old_count, new_start, new_count) = parse_hunk_header(line)?;
            old_lineno = old_start;
            new_lineno = new_start;
            current_hunk = Some(DiffHunk {
                old_start,
                old_count,
                new_start,
                new_count,
                header: line.to_string(),
                lines: Vec::new(),
            });
            continue;
        }

        if let Some(hunk) = current_hunk.as_mut() {
            match line.chars().next() {
                Some('+') => {
                    hunk.lines.push(DiffLine {
                        line_type: "add".to_string(),
                        content: line.to_string(),
                        old_lineno: None,
                        new_lineno: Some(new_lineno),
                    });
                    new_lineno += 1;
                }
                Some('-') => {
                    hunk.lines.push(DiffLine {
                        line_type: "remove".to_string(),
                        content: line.to_string(),
                        old_lineno: Some(old_lineno),
                        new_lineno: None,
                    });
                    old_lineno += 1;
                }
                Some(' ') => {
                    hunk.lines.push(DiffLine {
                        line_type: "context".to_string(),
                        content: line.to_string(),
                        old_lineno: Some(old_lineno),
                        new_lineno: Some(new_lineno),
                    });
                    old_lineno += 1;
                    new_lineno += 1;
                }
                _ => {}
            }
        }
    }

    if let Some(hunk) = current_hunk.take() {
        hunks.push(hunk);
    }

    Ok(FileDiff {
        file,
        old_file,
        status,
        hunks,
        is_binary,
    })
}

pub fn parse_diff_stat(output: &str) -> DiffStat {
    let mut stat = DiffStat::default();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty()
            || trimmed.contains("file changed")
            || trimmed.contains("files changed")
        {
            continue;
        }

        if let Some((file, graph)) = trimmed.split_once('|') {
            let additions = graph.chars().filter(|c| *c == '+').count();
            let deletions = graph.chars().filter(|c| *c == '-').count();
            stat.total_additions += additions;
            stat.total_deletions += deletions;
            stat.files.push(DiffStatEntry {
                file: file.trim().to_string(),
                additions,
                deletions,
            });
        }
    }

    stat
}

pub fn parse_commit_result(output: &str) -> Result<CommitResult, GitError> {
    let line = output
        .lines()
        .find(|line| !line.trim().is_empty())
        .ok_or_else(|| GitError::Parse("commit command returned no output".to_string()))?;
    let sha = line.trim().to_string();

    Ok(CommitResult {
        short_sha: sha.chars().take(7).collect(),
        sha,
        summary: "Commit created".to_string(),
    })
}

pub fn parse_log(output: &str) -> Vec<CommitInfo> {
    output
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\x1f').collect();
            if parts.len() < 7 {
                return None;
            }
            let sha = parts[0].to_string();
            Some(CommitInfo {
                short_sha: sha.chars().take(7).collect(),
                sha,
                parents: parts[1]
                    .split_whitespace()
                    .filter(|value| !value.is_empty())
                    .map(ToString::to_string)
                    .collect(),
                refs: parts[2]
                    .split(", ")
                    .filter(|value| !value.is_empty())
                    .map(ToString::to_string)
                    .collect(),
                message: parts[3].to_string(),
                author: parts[4].to_string(),
                author_email: parts[5].to_string(),
                date: parts[6].to_string(),
                signature: parts.get(7).copied().unwrap_or("N").to_string(),
            })
        })
        .collect()
}

pub fn parse_show_commit(output: &str) -> Result<CommitDetail, GitError> {
    let mut lines = output.lines();
    let header = lines
        .next()
        .ok_or_else(|| GitError::Parse("git show returned no commit header".to_string()))?;

    // `git show --stat --format=...` lays out as:
    //   <formatted header line>
    //   <commit message body lines, possibly multi-line>
    //   <blank line>
    //    <path> | <N> <+/->...
    //    ...
    //    N files changed, X insertions(+), Y deletions(-)
    // There is no `---` separator. A stat line starts with whitespace and contains
    // " | <digits>"; the summary line contains "file changed" or "files changed".
    let mut body_lines: Vec<&str> = Vec::new();
    let mut stat_lines: Vec<&str> = Vec::new();
    let mut in_stat = false;
    for line in lines {
        if !in_stat {
            if is_stat_line(line) || is_stat_summary(line) {
                in_stat = true;
                stat_lines.push(line);
            } else {
                body_lines.push(line);
            }
        } else {
            stat_lines.push(line);
        }
    }
    let body = body_lines.join("\n").trim().to_string();

    let info = parse_log(header)
        .into_iter()
        .next()
        .ok_or_else(|| GitError::Parse("unable to parse commit header".to_string()))?;

    let mut files = Vec::new();
    for line in stat_lines {
        if is_stat_summary(line) {
            continue;
        }
        if let Some((file, graph)) = line.split_once('|') {
            let file = file.trim();
            if file.is_empty() {
                continue;
            }
            files.push(CommitFileStat {
                file: file.to_string(),
                additions: graph.chars().filter(|c| *c == '+').count(),
                deletions: graph.chars().filter(|c| *c == '-').count(),
                status: "M".to_string(),
            });
        }
    }

    Ok(CommitDetail { info, body, files })
}

fn is_stat_line(line: &str) -> bool {
    let trimmed = line.trim_start();
    if trimmed == line {
        // No leading whitespace — stat lines from `git show --stat` are indented.
        return false;
    }
    if let Some((_, rest)) = trimmed.split_once('|') {
        let rest = rest.trim_start();
        rest.chars().next().is_some_and(|c| c.is_ascii_digit())
    } else {
        false
    }
}

fn is_stat_summary(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed.contains("file changed") || trimmed.contains("files changed")
}

pub fn parse_branches(output: &str) -> Vec<BranchInfo> {
    output
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\x1f').collect();
            if parts.len() < 6 {
                return None;
            }

            let full_ref = parts[0];
            // Skip the implicit `refs/remotes/<remote>/HEAD` pointer — git emits
            // it from `branch -a` but it's a symbolic alias, not a real branch.
            if full_ref.ends_with("/HEAD") {
                return None;
            }

            let (is_remote, name) = if let Some(short) = full_ref.strip_prefix("refs/heads/") {
                (false, short.to_string())
            } else if let Some(short) = full_ref.strip_prefix("refs/remotes/") {
                (true, short.to_string())
            } else {
                // Unknown ref namespace (e.g. tags arriving here by accident) — skip.
                return None;
            };

            Some(BranchInfo {
                name,
                is_current: parts[1].trim() == "*",
                is_remote,
                upstream: if parts[2].is_empty() {
                    None
                } else {
                    Some(parts[2].to_string())
                },
                last_commit_sha: parts[3].to_string(),
                last_commit_date: parts[4].to_string(),
                last_commit_author_email: parts[5].to_string(),
            })
        })
        .collect()
}

pub fn parse_remotes(output: &str) -> Vec<RemoteInfo> {
    // `git remote -v` lines look like:  `<name>\t<url> (fetch)` / `(push)`.
    // Names cannot contain whitespace, but URLs occasionally do (file:// paths
    // pointing at folders with spaces), so we split on the leading tab and then
    // separate the trailing `(fetch)`/`(push)` marker from the URL.
    let mut remotes = std::collections::BTreeMap::<String, RemoteInfo>::new();

    for line in output.lines() {
        let Some((name, rest)) = line.split_once('\t') else {
            continue;
        };
        let rest = rest.trim_end();
        let (url, kind) = match rest.rsplit_once(' ') {
            Some((url, kind)) if kind.starts_with('(') && kind.ends_with(')') => (url, kind),
            _ => continue,
        };

        let name = name.to_string();
        let entry = remotes.entry(name.clone()).or_insert(RemoteInfo {
            name,
            fetch_url: String::new(),
            push_url: String::new(),
        });

        if kind == "(fetch)" {
            entry.fetch_url = url.to_string();
        } else if kind == "(push)" {
            entry.push_url = url.to_string();
        }
    }

    remotes.into_values().collect()
}

pub fn parse_blame(output: &str) -> Result<Vec<BlameLine>, GitError> {
    // git blame --porcelain format:
    //   <sha> <orig_line> <final_line> [<count>]
    //   [metadata lines (only on FIRST occurrence of <sha> in this output)]
    //   \t<content>
    // For subsequent lines in the same consecutive group: 3-field header, no metadata.
    // For a re-occurrence of a SHA that's already been described: 4-field header
    // (with count=1) but NO metadata — git assumes the reader has it cached.
    // Therefore we MUST cache metadata per SHA across the whole output and only
    // overwrite the working copy when metadata actually follows.
    use std::collections::HashMap;

    #[derive(Default, Clone)]
    struct CommitMeta {
        author: String,
        author_email: String,
        date: String,
        summary: String,
    }

    let mut lines = output.lines().peekable();
    let mut blame_lines = Vec::new();
    let mut cache: HashMap<String, CommitMeta> = HashMap::new();

    while let Some(line) = lines.next() {
        if line.is_empty() {
            continue;
        }

        let header_parts = line.split_whitespace().collect::<Vec<_>>();
        if header_parts.len() < 3 || header_parts[0].len() != 40 {
            continue;
        }

        let sha = header_parts[0].to_string();
        let original_line: usize = header_parts[1]
            .parse()
            .map_err(|_| GitError::Parse(format!("invalid blame original line: {line}")))?;
        let final_line: usize = header_parts[2]
            .parse()
            .map_err(|_| GitError::Parse(format!("invalid blame final line: {line}")))?;

        // Read any metadata lines that follow this header (until we hit the
        // tab-prefixed content line). Stays empty for headers without metadata.
        let mut found_meta = CommitMeta::default();
        let mut got_any = false;
        while let Some(next) = lines.peek() {
            if next.starts_with('\t') {
                break;
            }
            let meta = lines.next().unwrap_or_default();
            got_any = true;
            if let Some(value) = meta.strip_prefix("author ") {
                found_meta.author = value.to_string();
            } else if let Some(value) = meta.strip_prefix("author-mail ") {
                found_meta.author_email = value.trim_matches(['<', '>']).to_string();
            } else if let Some(value) = meta.strip_prefix("author-time ") {
                found_meta.date = value.to_string();
            } else if let Some(value) = meta.strip_prefix("summary ") {
                found_meta.summary = value.to_string();
            }
        }
        if got_any {
            cache.insert(sha.clone(), found_meta);
        }

        // Each header is followed by exactly one tab-prefixed content line.
        let content_line = lines
            .next()
            .ok_or_else(|| GitError::Parse("missing blame content line".to_string()))?;
        let content = content_line
            .strip_prefix('\t')
            .unwrap_or(content_line)
            .to_string();

        let meta = cache.get(&sha).cloned().unwrap_or_default();
        blame_lines.push(BlameLine {
            sha,
            author: meta.author,
            author_email: meta.author_email,
            date: meta.date,
            line_number: final_line,
            content,
            original_line,
            summary: meta.summary,
        });
    }

    Ok(blame_lines)
}

pub fn parse_reflog(output: &str) -> Vec<ReflogEntry> {
    output
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\x1f').collect();
            if parts.len() != 5 {
                return None;
            }

            let sha = parts[1].to_string();
            Some(ReflogEntry {
                selector: parts[0].to_string(),
                short_sha: sha.chars().take(7).collect(),
                sha,
                message: parts[2].to_string(),
                author: parts[3].to_string(),
                date: parts[4].to_string(),
            })
        })
        .collect()
}

pub fn parse_stashes(output: &str) -> Vec<StashEntry> {
    output
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\x1f').collect();
            if parts.len() != 5 {
                return None;
            }

            Some(StashEntry {
                stash_ref: parts[0].to_string(),
                sha: parts[1].to_string(),
                message: parts[2].to_string(),
                date: parts[3].to_string(),
                author: parts[4].to_string(),
            })
        })
        .collect()
}

pub fn parse_tags(output: &str) -> Vec<TagInfo> {
    output
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\x1f').collect();
            if parts.len() != 6 {
                return None;
            }

            Some(TagInfo {
                name: parts[0].to_string(),
                sha: parts[1].to_string(),
                message: if parts[2].is_empty() {
                    None
                } else {
                    Some(parts[2].to_string())
                },
                is_annotated: parts[3] == "tag",
                tagger: if parts[4].is_empty() {
                    None
                } else {
                    Some(parts[4].to_string())
                },
                date: if parts[5].is_empty() {
                    None
                } else {
                    Some(parts[5].to_string())
                },
            })
        })
        .collect()
}

pub fn parse_worktrees(output: &str, main_repo_path: &str) -> Vec<WorktreeInfo> {
    let mut worktrees = Vec::new();
    let mut path = None;
    let mut branch = None;
    let mut sha = None;

    for line in output.lines().chain(std::iter::once("")) {
        if let Some(value) = line.strip_prefix("worktree ") {
            path = Some(value.to_string());
            continue;
        }

        if let Some(value) = line.strip_prefix("HEAD ") {
            sha = Some(value.to_string());
            continue;
        }

        if let Some(value) = line.strip_prefix("branch ") {
            branch = Some(value.trim_start_matches("refs/heads/").to_string());
            continue;
        }

        if line.is_empty() {
            if let (Some(path), Some(sha)) = (path.take(), sha.take()) {
                let branch = branch.take().unwrap_or_else(|| "DETACHED".to_string());
                worktrees.push(WorktreeInfo {
                    is_main: path == main_repo_path,
                    path,
                    branch,
                    sha,
                });
            }
        }
    }

    worktrees
}

fn parse_hunk_header(header: &str) -> Result<(usize, usize, usize, usize), GitError> {
    let cleaned = header
        .trim_matches('@')
        .trim()
        .split_whitespace()
        .take(2)
        .collect::<Vec<_>>();

    if cleaned.len() != 2 {
        return Err(GitError::Parse(format!("invalid hunk header: {header}")));
    }

    let (old_start, old_count) = parse_hunk_range(cleaned[0].trim_start_matches('-'))?;
    let (new_start, new_count) = parse_hunk_range(cleaned[1].trim_start_matches('+'))?;
    Ok((old_start, old_count, new_start, new_count))
}

fn parse_hunk_range(range: &str) -> Result<(usize, usize), GitError> {
    if let Some((start, count)) = range.split_once(',') {
        Ok((
            start
                .parse()
                .map_err(|_| GitError::Parse(format!("invalid hunk start: {range}")))?,
            count
                .parse()
                .map_err(|_| GitError::Parse(format!("invalid hunk count: {range}")))?,
        ))
    } else {
        let start = range
            .parse()
            .map_err(|_| GitError::Parse(format!("invalid hunk range: {range}")))?;
        Ok((start, 1))
    }
}

#[cfg(test)]
mod parser_tests {
    use super::*;

    #[test]
    fn parse_remotes_handles_url_with_spaces() {
        // file:// URLs pointing at folders with spaces are legal.
        let output =
            "origin\tfile:///home/me/My Projects/repo.git (fetch)\n\
             origin\tfile:///home/me/My Projects/repo.git (push)\n";
        let remotes = parse_remotes(output);
        assert_eq!(remotes.len(), 1);
        assert_eq!(remotes[0].name, "origin");
        assert_eq!(remotes[0].fetch_url, "file:///home/me/My Projects/repo.git");
        assert_eq!(remotes[0].push_url, "file:///home/me/My Projects/repo.git");
    }

    #[test]
    fn parse_remotes_splits_fetch_and_push() {
        let output =
            "origin\tgit@github.com:a/b.git (fetch)\n\
             origin\thttps://example.com/a/b.git (push)\n\
             upstream\tgit@github.com:x/y.git (fetch)\n\
             upstream\tgit@github.com:x/y.git (push)\n";
        let remotes = parse_remotes(output);
        assert_eq!(remotes.len(), 2);
        let origin = remotes.iter().find(|r| r.name == "origin").unwrap();
        assert_eq!(origin.fetch_url, "git@github.com:a/b.git");
        assert_eq!(origin.push_url, "https://example.com/a/b.git");
    }

    #[test]
    fn parse_remotes_skips_malformed_lines() {
        let output = "garbage without tab\norigin\tgit@example.com:a/b.git (fetch)\n";
        let remotes = parse_remotes(output);
        assert_eq!(remotes.len(), 1);
        assert_eq!(remotes[0].fetch_url, "git@example.com:a/b.git");
    }

    #[test]
    fn parse_blame_attaches_metadata_to_all_lines_in_run() {
        let output = "\
0000000000000000000000000000000000000001 1 1 2\n\
author Alice\n\
author-mail <alice@example.com>\n\
author-time 1700000000\n\
summary First change\n\
filename src/main.rs\n\
\tfn main() {\n\
0000000000000000000000000000000000000001 2 2\n\
\t    println!(\"hi\");\n";
        let lines = parse_blame(output).expect("blame should parse");
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].author, "Alice");
        assert_eq!(lines[0].author_email, "alice@example.com");
        assert_eq!(lines[0].summary, "First change");
        // The second line shares the SHA — metadata must come from the cache.
        assert_eq!(lines[1].author, "Alice");
        assert_eq!(lines[1].author_email, "alice@example.com");
        assert_eq!(lines[1].line_number, 2);
    }

    #[test]
    fn parse_log_splits_fields_and_parents() {
        let line = format!(
            "abc123def\u{1f}p1 p2\u{1f}HEAD -> main, origin/main\u{1f}A merge\u{1f}Alice\u{1f}alice@example.com\u{1f}2026-01-02 03:04:05 +0000\u{1f}G"
        );
        let commits = parse_log(&line);
        assert_eq!(commits.len(), 1);
        let commit = &commits[0];
        assert_eq!(commit.sha, "abc123def");
        assert_eq!(commit.short_sha, "abc123d");
        assert_eq!(commit.parents, vec!["p1".to_string(), "p2".to_string()]);
        assert_eq!(
            commit.refs,
            vec!["HEAD -> main".to_string(), "origin/main".to_string()]
        );
        assert_eq!(commit.message, "A merge");
        assert_eq!(commit.signature, "G");
    }

    #[test]
    fn parse_branches_skips_remote_head_pointer() {
        let output = format!(
            "refs/heads/main\u{1f}*\u{1f}origin/main\u{1f}abc\u{1f}2026-01-01\u{1f}me@example.com\n\
             refs/remotes/origin/HEAD\u{1f} \u{1f}\u{1f}\u{1f}\u{1f}\n\
             refs/remotes/origin/main\u{1f} \u{1f}\u{1f}abc\u{1f}2026-01-01\u{1f}me@example.com\n"
        );
        let branches = parse_branches(&output);
        assert_eq!(branches.len(), 2);
        assert!(branches.iter().any(|b| b.name == "main" && b.is_current));
        assert!(branches
            .iter()
            .any(|b| b.name == "origin/main" && b.is_remote));
    }

    #[test]
    fn parse_diff_extracts_hunks_and_line_numbers() {
        // NB: build the patch by concatenation so the leading space on the
        // context line is preserved (a `\` continuation would eat it).
        let output = [
            "diff --git a/foo.txt b/foo.txt",
            "--- a/foo.txt",
            "+++ b/foo.txt",
            "@@ -1,2 +1,3 @@",
            " context",
            "-old",
            "+new",
            "+extra",
            "",
        ]
        .join("\n");
        let diff = parse_diff(&output).expect("diff should parse");
        assert_eq!(diff.file, "foo.txt");
        assert!(!diff.is_binary);
        assert_eq!(diff.hunks.len(), 1);
        let hunk = &diff.hunks[0];
        assert_eq!(hunk.old_start, 1);
        assert_eq!(hunk.new_start, 1);
        assert_eq!(hunk.lines.len(), 4);
        assert_eq!(hunk.lines[0].line_type, "context");
        assert_eq!(hunk.lines[1].line_type, "remove");
        assert_eq!(hunk.lines[2].line_type, "add");
        assert_eq!(hunk.lines[2].new_lineno, Some(2));
    }

    #[test]
    fn parse_diff_detects_binary_files() {
        let output = "\
diff --git a/image.png b/image.png\n\
Binary files a/image.png and b/image.png differ\n";
        let diff = parse_diff(output).expect("binary diff should parse");
        assert!(diff.is_binary);
        assert!(diff.hunks.is_empty());
    }

    #[test]
    fn parse_diff_handles_combined_diff_for_unmerged_path() {
        let output = "\
diff --cc file.txt\n\
index d791e9b,00dbdcf..0000000\n\
--- a/file.txt\n\
+++ b/file.txt\n\
@@@ -1,3 -1,3 +1,7 @@@\n\
  line1\n\
++<<<<<<< HEAD\n\
 +MAIN\n\
++=======\n\
+ FEATURE\n\
++>>>>>>> feature\n\
  line3\n";
        let diff = parse_diff(output).expect("combined diff should not error");
        assert_eq!(diff.file, "file.txt");
        assert_eq!(diff.status.as_deref(), Some("U"));
        assert!(diff.hunks.is_empty());
        assert!(!diff.is_binary);
    }

    #[test]
    fn parse_diff_marks_new_and_deleted_files() {
        let new_file = "\
diff --git a/foo.txt b/foo.txt\n\
new file mode 100644\n\
--- /dev/null\n\
+++ b/foo.txt\n\
@@ -0,0 +1,1 @@\n\
+new\n";
        let diff = parse_diff(new_file).expect("new file should parse");
        assert_eq!(diff.status.as_deref(), Some("A"));

        let deleted = "\
diff --git a/foo.txt b/foo.txt\n\
deleted file mode 100644\n\
--- a/foo.txt\n\
+++ /dev/null\n\
@@ -1,1 +0,0 @@\n\
-old\n";
        let diff = parse_diff(deleted).expect("deleted file should parse");
        assert_eq!(diff.status.as_deref(), Some("D"));
    }

    #[test]
    fn parse_hunk_header_handles_function_context() {
        // Function context after the second `@@` must not break range parsing.
        let (old_start, old_count, new_start, new_count) =
            parse_hunk_header("@@ -10,5 +12,7 @@ fn main() {").expect("hunk should parse");
        assert_eq!((old_start, old_count, new_start, new_count), (10, 5, 12, 7));
    }

    #[test]
    fn parse_hunk_header_handles_single_line_form() {
        let (old_start, old_count, new_start, new_count) =
            parse_hunk_header("@@ -3 +3 @@").expect("single-line hunk should parse");
        assert_eq!((old_start, old_count, new_start, new_count), (3, 1, 3, 1));
    }

    #[test]
    fn parse_worktrees_marks_main_and_handles_detached() {
        let output = "\
worktree /home/me/repo\n\
HEAD abcdef\n\
branch refs/heads/main\n\
\n\
worktree /home/me/feature\n\
HEAD 123456\n\
detached\n\
\n";
        let worktrees = parse_worktrees(output, "/home/me/repo");
        assert_eq!(worktrees.len(), 2);
        assert!(worktrees[0].is_main);
        assert_eq!(worktrees[0].branch, "main");
        assert!(!worktrees[1].is_main);
        assert_eq!(worktrees[1].branch, "DETACHED");
    }

    #[test]
    fn parse_stashes_requires_all_fields() {
        let line = format!("stash@{{0}}\u{1f}abc\u{1f}WIP\u{1f}2026-01-01\u{1f}Alice");
        let entries = parse_stashes(&line);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].stash_ref, "stash@{0}");
        assert_eq!(entries[0].message, "WIP");

        let malformed = "stash@{0}\u{1f}only-two-fields";
        let entries = parse_stashes(malformed);
        assert!(entries.is_empty());
    }

    #[test]
    fn parse_tags_marks_annotated_vs_lightweight() {
        let output = format!(
            "v1.0\u{1f}sha1\u{1f}initial release\u{1f}tag\u{1f}Alice\u{1f}2026-01-01\n\
             v0.9\u{1f}sha2\u{1f}\u{1f}commit\u{1f}\u{1f}\n"
        );
        let tags = parse_tags(&output);
        assert_eq!(tags.len(), 2);
        let v1 = tags.iter().find(|t| t.name == "v1.0").unwrap();
        assert!(v1.is_annotated);
        assert_eq!(v1.message.as_deref(), Some("initial release"));
        let v09 = tags.iter().find(|t| t.name == "v0.9").unwrap();
        assert!(!v09.is_annotated);
        assert!(v09.message.is_none());
        assert!(v09.tagger.is_none());
    }

    #[test]
    fn parse_diff_stat_aggregates_totals() {
        let output = "\
 src/foo.rs |  5 +++--\n\
 src/bar.rs | 10 ++++++----\n\
 2 files changed, 9 insertions(+), 6 deletions(-)\n";
        let stat = parse_diff_stat(output);
        assert_eq!(stat.files.len(), 2);
        assert_eq!(stat.total_additions, 9);
        assert_eq!(stat.total_deletions, 6);
    }
}
