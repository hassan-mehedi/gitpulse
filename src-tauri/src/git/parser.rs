use crate::error::GitError;
use crate::git::types::{
    BlameLine, BranchInfo, CommitDetail, CommitFileStat, CommitInfo, CommitResult, DiffHunk,
    DiffLine, DiffStat, DiffStatEntry, FileChange, FileDiff, ReflogEntry, RemoteInfo, RepoStatus,
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
            let mut parts = rest.split(" b/");
            old_file = parts.next().map(|value| value.to_string());
            file = parts.next().unwrap_or_default().to_string();
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
    let body = lines
        .by_ref()
        .take_while(|line| !line.starts_with("---"))
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();

    let info = parse_log(header)
        .into_iter()
        .next()
        .ok_or_else(|| GitError::Parse("unable to parse commit header".to_string()))?;

    let mut files = Vec::new();
    for line in lines {
        if let Some((file, graph)) = line.split_once('|') {
            files.push(CommitFileStat {
                file: file.trim().to_string(),
                additions: graph.chars().filter(|c| *c == '+').count(),
                deletions: graph.chars().filter(|c| *c == '-').count(),
                status: "M".to_string(),
            });
        }
    }

    Ok(CommitDetail { info, body, files })
}

pub fn parse_branches(output: &str) -> Vec<BranchInfo> {
    output
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\x1f').collect();
            if parts.len() != 5 {
                return None;
            }

            Some(BranchInfo {
                name: parts[0].to_string(),
                is_current: parts[1] == "*",
                is_remote: parts[0].starts_with("remotes/"),
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
    let mut lines = output.lines().peekable();
    let mut blame_lines = Vec::new();
    let mut author = String::new();
    let mut author_email = String::new();
    let mut date = String::new();
    let mut summary = String::new();

    while let Some(line) = lines.next() {
        if line.is_empty() {
            continue;
        }

        let header_parts = line.split_whitespace().collect::<Vec<_>>();
        if header_parts.len() < 4 || header_parts[0].len() < 7 {
            continue;
        }

        let sha = header_parts[0].to_string();
        let original_line: usize = header_parts[1]
            .parse()
            .map_err(|_| GitError::Parse(format!("invalid blame original line: {line}")))?;
        let final_line: usize = header_parts[2]
            .parse()
            .map_err(|_| GitError::Parse(format!("invalid blame final line: {line}")))?;
        let group_size: usize = header_parts[3]
            .parse()
            .map_err(|_| GitError::Parse(format!("invalid blame group size: {line}")))?;

        author.clear();
        author_email.clear();
        date.clear();
        summary.clear();

        while let Some(next) = lines.peek() {
            if next.starts_with('\t') {
                break;
            }

            let meta = lines.next().unwrap_or_default();
            if let Some(value) = meta.strip_prefix("author ") {
                author = value.to_string();
            } else if let Some(value) = meta.strip_prefix("author-mail ") {
                author_email = value.trim_matches(['<', '>']).to_string();
            } else if let Some(value) = meta.strip_prefix("author-time ") {
                date = value.to_string();
            } else if let Some(value) = meta.strip_prefix("summary ") {
                summary = value.to_string();
            }
        }

        for offset in 0..group_size {
            let content_line = lines
                .next()
                .ok_or_else(|| GitError::Parse("missing blame content line".to_string()))?;
            let content = content_line.strip_prefix('\t').unwrap_or(content_line).to_string();
            blame_lines.push(BlameLine {
                sha: sha.clone(),
                author: author.clone(),
                author_email: author_email.clone(),
                date: date.clone(),
                line_number: final_line + offset,
                content,
                original_line: original_line + offset,
                summary: summary.clone(),
            });
        }
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
