use crate::error::GitError;
use crate::git::types::{
    BlameLine, BranchInfo, CommitDetail, CommitFileStat, CommitInfo, CommitResult, DiffHunk,
    DiffLine, DiffStat, DiffStatEntry, FileChange, FileDiff, ReflogEntry, RemoteInfo, RepoStatus,
    StashEntry, TagInfo, WorktreeInfo,
};

pub fn parse_status(output: &str, stash_count: usize) -> Result<RepoStatus, GitError> {
    let mut branch = "HEAD".to_string();
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
            let mut parts = line.split_whitespace();
            let kind = parts.next().unwrap_or_default();
            let xy = parts.next().unwrap_or("..");
            let _sub = parts.next();
            let _m_h = parts.next();
            let _m_i = parts.next();
            let _m_w = parts.next();
            let _h_h = parts.next();
            let _h_i = parts.next();
            let path = parts.next().unwrap_or_default().to_string();
            let old_path = if kind == "2" {
                parts.next().map(|value| value.to_string())
            } else {
                None
            };

            let index_status = xy.chars().next().unwrap_or('.');
            let worktree_status = xy.chars().nth(1).unwrap_or('.');

            if index_status != '.' {
                staged.push(FileChange {
                    path: path.clone(),
                    old_path: old_path.clone(),
                    status: index_status.to_string(),
                    staged: true,
                });
            }

            if worktree_status != '.' {
                if worktree_status == 'U' || index_status == 'U' {
                    has_conflicts = true;
                }

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
        upstream,
        ahead,
        behind,
        changes,
        staged,
        stash_count,
        has_conflicts,
    })
}

pub fn parse_diff(output: &str) -> Result<FileDiff, GitError> {
    let mut file = String::new();
    let mut old_file = None;
    let mut hunks = Vec::new();
    let mut current_hunk: Option<DiffHunk> = None;
    let mut old_lineno = 0usize;
    let mut new_lineno = 0usize;
    let mut is_binary = false;

    for line in output.lines() {
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
        hunks,
        is_binary,
    })
}

pub fn parse_diff_stat(output: &str) -> DiffStat {
    let mut stat = DiffStat::default();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.contains("file changed") || trimmed.contains("files changed")
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
            if parts.len() != 7 {
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
            if parts.len() < 5 {
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
            })
        })
        .collect()
}

pub fn parse_remotes(output: &str) -> Vec<RemoteInfo> {
    let mut remotes = std::collections::BTreeMap::<String, RemoteInfo>::new();

    for line in output.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 3 {
            continue;
        }

        let name = parts[0].to_string();
        let url = parts[1].to_string();
        let kind = parts[2];
        let entry = remotes.entry(name.clone()).or_insert(RemoteInfo {
            name,
            fetch_url: String::new(),
            push_url: String::new(),
        });

        if kind.contains("(fetch)") {
            entry.fetch_url = url;
        } else if kind.contains("(push)") {
            entry.push_url = url;
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
        let content = content_line.strip_prefix('\t').unwrap_or(content_line).to_string();

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
