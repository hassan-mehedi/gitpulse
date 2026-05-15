# GitPulse Findings

## High Priority

1. Filenames with spaces are not parsed safely from `git status`.
   - `src-tauri/src/git/parser.rs` uses `split_whitespace()` for porcelain-v2 records.
   - Paths such as `docs/my file.md` can be split incorrectly, breaking staging, diff opening, discard, and rename handling.

2. The stage-all commit prompt exposes `Never` and `Always`, but neither choice is persisted.
   - `Always` behaves like a one-shot `Yes`.
   - `Never` behaves like `Cancel`.
   - The UI promises a saved preference but no preference exists yet.

## Medium Priority

1. Several features exist in the backend but are not exposed well in the UI.
   - Clone and init repositories
   - Tag management
   - Worktree management
   - Full remote management

2. Common recovery and history operations are still missing.
   - Revert commit
   - Reset branch to commit (`soft`, `mixed`, `hard`)
   - Restore a file from a historical commit
   - Reflog recovery UI

3. Advanced Git tools are mostly command wrappers instead of complete workflows.
   - Bisect
   - Sparse checkout
   - LFS
   - Remotes
   - Hooks
   - Patches
   - Timeline

4. There is effectively no automated test coverage visible in the repo.
   - Parser and state-heavy Git flows need regression coverage.

## Important Features Still Missing

1. Repository lifecycle UI
   - Clone repository
   - Initialize repository
   - Recent repositories
   - Open from URL or filesystem

2. History recovery tools
   - Revert commit
   - Reset branch to commit
   - Restore file from historical commit
   - Reflog browser and recovery

3. Full remote management
   - List remotes
   - Add, rename, and remove remotes
   - Edit fetch and push URLs in a structured UI
   - Fetch prune from UI

4. Tags and worktrees
   - Tag list, delete, and push
   - Worktree list, create, remove, and prune

5. Commit identity UX refinements
   - Make repo-local Git config overrides more explicit
   - Keep per-repo identity assignment easy to audit

6. Deeper search and filtering
   - History search by author, message, and path
   - Graph author and date filters
   - Stash search
   - Branch sort options

7. Safety and usability
   - Undo last discard or stronger destructive-action guardrails
   - Better rename detection surfacing
   - Better submodule and LFS screens
   - A first-class timeline surface instead of raw output

## Optimization Opportunities

1. Avoid graph reloads on ordinary working-tree refreshes.
   - Reload on repo path, HEAD, or ref changes, not on every status object replacement.

2. Reduce hot-path status refresh cost.
   - `git status` and `git stash list` currently run serially for every refresh.
   - Run them concurrently or avoid recomputing stash count unless stash refs changed.

3. Throttle or sequence auto-fetch across repositories.
   - Current behavior can launch many network Git commands at once in multi-repo workspaces.

4. Batch diff syntax highlighting.
   - Current rendering highlights line-by-line with many async state updates.

5. Cache commit details by SHA.
   - Graph, file history, and blame repeatedly fetch the same commit metadata.

6. Cache Git user identity lookups per repository.
   - These values rarely change but are re-read during branch refreshes.

7. Replace raw tool output with structured views where practical.
   - Remotes, LFS locks, submodules, and timeline are good first candidates.

8. Reduce duplicate Git output event work.
   - Prefer one authoritative progress path instead of emitting overlapping frontend and backend events.

## Recommended Order

1. Fix status parsing correctness.
2. Persist stage-all commit choices.
3. Add parser regression tests.
4. Expose already-built backend features in the UI:
   - Remotes
   - Tags
   - Worktrees
   - Clone/init
5. Add history recovery operations.
6. Optimize graph reloads, status refresh, diff highlighting, and commit-detail fetching.
