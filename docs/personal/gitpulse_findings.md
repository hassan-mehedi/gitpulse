# GitPulse Findings (verified 2026-05-16)

Most items from the previous revision of this document have since been implemented or were never real bugs. This pass verifies every claim against the actual code.

## Confirmed open issues

### Bugs

1. **Never button on the stage-all prompt discards the pending commit.**
   - `src/components/source-control/CommitInput.tsx:408-411` — clicking Never stores the preference (`setStageAllOnCommit("never")`) and closes the prompt but does not run the commit the user just attempted. The user has to click commit again.
   - Yes/Always run `confirmStageAndCommit()`; Never should run an unstaged commit (mirror of how the "never" preference already behaves on line 218 fall-through).

2. **External editor command is split on whitespace.**
   - `src-tauri/src/commands/external.rs:80` — `editor.split_whitespace()` breaks editor commands with spaces in the path (`"/Applications/Sublime Text.app/..."`) or in arguments. Use a shell-aware splitter (e.g. the `shell-words` crate) or treat the configured string as the command and accept args separately.
   - Same file `:50`/`:90` build `path:line` without escaping; on Windows, drive-letter paths like `C:\…:42` produce ambiguous targets. Marginal but worth handling.

3. **`parse_remotes` splits on whitespace.**
   - `src-tauri/src/git/parser.rs:468` — names cannot contain spaces but URLs can (e.g. `file:///some path/repo`). Split on tab first (`git remote -v` uses TAB between name and URL), then parse the kind suffix.

### Features

4. **No combined-diff or parent-picker for merge commits.**
   - `src-tauri/src/git/diff.rs:17-23` always diffs a commit against its first parent. For merge commits this hides the contribution of the other parent. A typical Git GUI shows the combined diff (`git diff-tree --cc -p`) for merge commits or offers a parent selector.

5. **No Rust unit tests beyond `parse_status`.**
   - `src-tauri/src/git/parser.rs` has three tests for status spaces (`:117-154`) but no coverage for `parse_remotes`, `parse_blame`, `parse_log`, `parse_branches`, `parse_diff`, `parse_show_commit`, `parse_worktrees`. The TS side has `aiCommit.test.ts`, `commitDrafts.test.ts`, `conflicts.test.ts`, `errors.test.ts`, `miscViews.test.ts` — Rust parsers are the biggest test gap.

### Optimizations

6. **Auto-fetch loops sequentially across repos.**
   - `src/hooks/useAutoFetch.ts:28-31` — `for (const repo of repositories) { await … }`. In multi-repo workspaces every interval tick has to wait through all fetches serially. Bounded parallelism (e.g. 3 concurrent) is a real win.

7. **Commit details cache size and Vite bundle.**
   - `src/lib/commitDetails.ts:4` — `MAX_COMMIT_DETAILS = 200`. Reasonable starting point but gets blown by scrolling a large graph and revisiting commits. Bumping to ~1000–2000 entries is cheap.
   - `vite.config.ts` has no `build.rollupOptions.output.manualChunks`. Splitting Shiki and the iconify dataset into their own chunks helps cold start, but bundle size on a desktop app is low-impact.

---

## Items already implemented (previously listed as gaps)

For reference, so we don't re-open these:

- Filenames with spaces in `git status` — fixed via `splitn(9/10/11, ' ')` with regression tests (`parser.rs:93-154`).
- File watcher coalescing — done; per-repo timer in `useFileWatcher.ts:24-42`.
- Graph reload triggers — already keyed on primitives (`selectedRepo?.branch`, `selectedRepo?.headSha`) at `CommitGraphList.tsx:114`.
- `SourceControlPanel` narrow selectors — every store read is `(state) => state.xxx`.
- Reset/Revert in graph context menu — `CommitGraphList.tsx:611-617`.
- File restore from commit — `FileHistoryPanel.tsx:172`.
- Structured remotes/tags/worktrees panels — `MiscPanel.tsx:378-491` (ToolRow lists + ToolForm inputs).
- Clone from URL — `SourceControlPanel.tsx:463`/`:555`.
- Graph search (message/author/path/since) — `CommitGraphList.tsx:61-64`.
- Branch filter + sort — `BranchManager.tsx:96-98`.
- Stash filter — `StashSection.tsx:24-26`.
- Reflog modal, interactive rebase, line staging, blame, cherry-pick, conflict editor, recent repos.

---

## Items previously reported but invalid

- "`parse_blame` header has spaces" — porcelain blame headers are `<40-char SHA> <int> <int> [<int>]` by spec; no spaces possible in any field.
- "`parse_hunk_header` loses function context" — the function context after the second `@@` is preserved verbatim in `DiffHunk.header`; only the numeric ranges are extracted by `parse_hunk_header`.
- "Merge commit diff falls back to empty tree against other parents" — the code does not iterate parents; it consistently uses the first parent. The real concern is UX (no combined diff or parent picker), captured above.
- "`stageAllOnCommit = never` preference is never read back" — read at `CommitInput.tsx:218`; falls through to a no-stage commit when set.
- "`resolveCommitIdentity` should be memoized" — pure function, single `Array.find`, not measurably hot.

---

## Suggested order

1. Never button executes the commit (small, user-visible).
2. External editor command splitting (small, fixes a long-tail crash).
3. `parse_remotes` tab-aware split (small, defensive).
4. Rust parser unit tests (small per parser; high leverage for regression safety).
5. Auto-fetch bounded concurrency (small, latency win).
6. Combined-diff or parent picker for merge commits (medium, feature).
7. Commit details cache bump + Vite manualChunks (small polish).
