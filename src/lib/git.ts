import { invoke } from "@tauri-apps/api/core";
import type {
  BlameLine,
  BranchInfo,
  CherryPickResult,
  CommitDetail,
  CommitInfo,
  CommitResult,
  ConflictContent,
  DiffStat,
  FileDiff,
  GitError,
  OperationResult,
  ProgressPayload,
  ReflogEntry,
  RepoStatus,
  RemoteInfo,
  Repository,
  StashEntry,
  TagInfo,
  UserInfo,
  WorktreeInfo,
  WorkspaceState
} from "../types/git";

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function gitInvoke<T>(command: string, args: Record<string, unknown>): Promise<T> {
  if (!isTauriRuntime()) {
    throw {
      kind: "unavailable",
      message: "Tauri runtime is not available in the browser preview."
    } satisfies GitError;
  }

  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw error as GitError;
  }
}

export async function openRepositoryTarget(path: string): Promise<WorkspaceState> {
  return gitInvoke("open_repository_target", { path });
}

export async function openWorkspaceFile(filePath: string): Promise<Repository[]> {
  return gitInvoke("open_workspace_file", { filePath });
}

export async function gitStatus(repoPath: string): Promise<RepoStatus> {
  return gitInvoke("git_status", { repoPath });
}

export async function gitDiffFile(repoPath: string, file: string, staged = false): Promise<FileDiff> {
  return gitInvoke("git_diff_file", { repoPath, file, staged });
}

export async function gitDiffStat(repoPath: string): Promise<DiffStat> {
  return gitInvoke("git_diff_stat", { repoPath });
}

export async function gitDiffStagedStat(repoPath: string): Promise<DiffStat> {
  return gitInvoke("git_diff_staged_stat", { repoPath });
}

export async function gitStageFile(repoPath: string, file: string): Promise<void> {
  return gitInvoke("git_stage_file", { repoPath, file });
}

export async function gitStageAll(repoPath: string): Promise<void> {
  return gitInvoke("git_stage_all", { repoPath });
}

export async function gitStageLines(repoPath: string, file: string, patch: string): Promise<void> {
  return gitInvoke("git_stage_lines", { repoPath, file, patch });
}

export async function gitUnstageFile(repoPath: string, file: string): Promise<void> {
  return gitInvoke("git_unstage_file", { repoPath, file });
}

export async function gitUnstageAll(repoPath: string): Promise<void> {
  return gitInvoke("git_unstage_all", { repoPath });
}

export async function gitUnstageLines(repoPath: string, file: string, patch: string): Promise<void> {
  return gitInvoke("git_unstage_lines", { repoPath, file, patch });
}

export async function gitCommit(repoPath: string, message: string): Promise<CommitResult> {
  return gitInvoke("git_commit", { repoPath, message });
}

export async function gitBranches(repoPath: string): Promise<BranchInfo[]> {
  return gitInvoke("git_branches", { repoPath });
}

export async function gitCurrentBranch(repoPath: string): Promise<string> {
  return gitInvoke("git_current_branch", { repoPath });
}

export async function gitCreateBranch(
  repoPath: string,
  name: string,
  source?: string
): Promise<void> {
  return gitInvoke("git_create_branch", { repoPath, name, source });
}

export async function gitSwitchBranch(repoPath: string, name: string): Promise<void> {
  return gitInvoke("git_switch_branch", { repoPath, name });
}

export async function gitRenameBranch(
  repoPath: string,
  old: string,
  next: string
): Promise<void> {
  return gitInvoke("git_rename_branch", { repoPath, old, new: next });
}

export async function gitDeleteBranch(
  repoPath: string,
  name: string,
  force = false
): Promise<void> {
  return gitInvoke("git_delete_branch", { repoPath, name, force });
}

export async function gitMerge(repoPath: string, branch: string): Promise<OperationResult> {
  return gitInvoke("git_merge", { repoPath, branch });
}

export async function gitRebase(repoPath: string, onto: string): Promise<OperationResult> {
  return gitInvoke("git_rebase", { repoPath, onto });
}

export async function gitAbortMerge(repoPath: string): Promise<void> {
  return gitInvoke("git_abort_merge", { repoPath });
}

export async function gitAbortRebase(repoPath: string): Promise<void> {
  return gitInvoke("git_abort_rebase", { repoPath });
}

export async function gitCherryPick(repoPath: string, sha: string): Promise<CherryPickResult> {
  return gitInvoke("git_cherry_pick", { repoPath, sha });
}

export async function gitCherryPickAbort(repoPath: string): Promise<void> {
  return gitInvoke("git_cherry_pick_abort", { repoPath });
}

export async function gitListConflicts(repoPath: string): Promise<string[]> {
  return gitInvoke("git_list_conflicts", { repoPath });
}

export async function gitGetConflictContent(
  repoPath: string,
  file: string
): Promise<ConflictContent> {
  return gitInvoke("git_get_conflict_content", { repoPath, file });
}

export async function gitMarkResolved(repoPath: string, file: string): Promise<void> {
  return gitInvoke("git_mark_resolved", { repoPath, file });
}

export async function gitSetConflictContent(
  repoPath: string,
  file: string,
  content: string
): Promise<void> {
  return gitInvoke("git_set_conflict_content", { repoPath, file, content });
}

export async function gitContinueMerge(repoPath: string): Promise<void> {
  return gitInvoke("git_continue_merge", { repoPath });
}

export async function gitListRemotes(repoPath: string): Promise<RemoteInfo[]> {
  return gitInvoke("git_list_remotes", { repoPath });
}

export async function gitAddRemote(repoPath: string, name: string, url: string): Promise<void> {
  return gitInvoke("git_add_remote", { repoPath, name, url });
}

export async function gitRemoveRemote(repoPath: string, name: string): Promise<void> {
  return gitInvoke("git_remove_remote", { repoPath, name });
}

export async function gitRenameRemote(
  repoPath: string,
  old: string,
  next: string
): Promise<void> {
  return gitInvoke("git_rename_remote", { repoPath, old, new: next });
}

export async function gitFetch(repoPath: string, remote?: string): Promise<void> {
  return gitInvoke("git_fetch", { repoPath, remote });
}

export async function gitFetchAll(repoPath: string): Promise<void> {
  return gitInvoke("git_fetch_all", { repoPath });
}

export async function gitFetchPrune(repoPath: string): Promise<void> {
  return gitInvoke("git_fetch_prune", { repoPath });
}

export async function gitSync(
  repoPath: string,
  remote?: string,
  branch?: string
): Promise<OperationResult> {
  return gitInvoke("git_sync", { repoPath, remote, branch });
}

export async function gitPull(
  repoPath: string,
  remote?: string,
  branch?: string
): Promise<OperationResult> {
  return gitInvoke("git_pull", { repoPath, remote, branch });
}

export async function gitPullRebase(
  repoPath: string,
  remote?: string,
  branch?: string
): Promise<OperationResult> {
  return gitInvoke("git_pull_rebase", { repoPath, remote, branch });
}

export async function gitPush(
  repoPath: string,
  remote?: string,
  branch?: string,
  force = false
): Promise<OperationResult> {
  return gitInvoke("git_push", { repoPath, remote, branch, force });
}

export async function gitPushSetUpstream(
  repoPath: string,
  remote: string,
  branch: string
): Promise<void> {
  return gitInvoke("git_push_set_upstream", { repoPath, remote, branch });
}

export async function gitListTags(repoPath: string): Promise<TagInfo[]> {
  return gitInvoke("git_list_tags", { repoPath });
}

export async function gitCreateTag(
  repoPath: string,
  name: string,
  sha?: string,
  message?: string
): Promise<OperationResult> {
  return gitInvoke("git_create_tag", { repoPath, name, sha, message });
}

export async function gitDeleteTag(repoPath: string, name: string): Promise<OperationResult> {
  return gitInvoke("git_delete_tag", { repoPath, name });
}

export async function gitPushTag(
  repoPath: string,
  remote: string,
  name: string
): Promise<OperationResult> {
  return gitInvoke("git_push_tag", { repoPath, remote, name });
}

export async function gitListWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  return gitInvoke("git_list_worktrees", { repoPath });
}

export async function gitAddWorktree(
  repoPath: string,
  path: string,
  branch?: string
): Promise<WorktreeInfo> {
  return gitInvoke("git_add_worktree", { repoPath, path, branch });
}

export async function gitRemoveWorktree(
  repoPath: string,
  path: string
): Promise<OperationResult> {
  return gitInvoke("git_remove_worktree", { repoPath, path });
}

export async function gitPruneWorktrees(repoPath: string): Promise<OperationResult> {
  return gitInvoke("git_prune_worktrees", { repoPath });
}

export async function gitCommitAll(repoPath: string, message: string): Promise<CommitResult> {
  return gitInvoke("git_commit_all", { repoPath, message });
}

export async function gitCommitAmend(repoPath: string, message?: string): Promise<CommitResult> {
  return gitInvoke("git_commit_amend", { repoPath, message });
}

export async function gitUndoLastCommit(repoPath: string): Promise<void> {
  return gitInvoke("git_undo_last_commit", { repoPath });
}

export async function gitLog(
  repoPath: string,
  n = 50,
  skip?: number,
  file?: string
): Promise<CommitInfo[]> {
  return gitInvoke("git_log", { repoPath, n, skip, file });
}

export async function gitGraph(repoPath: string, maxCount = 120): Promise<CommitInfo[]> {
  return gitInvoke("git_graph", { repoPath, maxCount });
}

export async function gitRefLog(repoPath: string, n = 50): Promise<ReflogEntry[]> {
  return gitInvoke("git_ref_log", { repoPath, n });
}

export async function gitShowCommit(repoPath: string, sha: string): Promise<CommitDetail> {
  const detail = await gitInvoke<{ info: CommitInfo; body: string; files: CommitDetail["files"] }>(
    "git_show_commit",
    { repoPath, sha }
  );

  return {
    ...detail.info,
    body: detail.body,
    files: detail.files
  };
}

export async function gitStashList(repoPath: string): Promise<StashEntry[]> {
  return gitInvoke("git_stash_list", { repoPath });
}

export async function gitStashPush(
  repoPath: string,
  message?: string,
  includeUntracked = false
): Promise<OperationResult> {
  return gitInvoke("git_stash_push", { repoPath, message, includeUntracked });
}

export async function gitStashPop(repoPath: string, stashRef?: string): Promise<OperationResult> {
  return gitInvoke("git_stash_pop", { repoPath, stashRef });
}

export async function gitStashApply(repoPath: string, stashRef?: string): Promise<OperationResult> {
  return gitInvoke("git_stash_apply", { repoPath, stashRef });
}

export async function gitStashDrop(repoPath: string, stashRef: string): Promise<OperationResult> {
  return gitInvoke("git_stash_drop", { repoPath, stashRef });
}

export async function gitStashShow(repoPath: string, stashRef: string): Promise<FileDiff[]> {
  return gitInvoke("git_stash_show", { repoPath, stashRef });
}

export async function gitStashClear(repoPath: string): Promise<OperationResult> {
  return gitInvoke("git_stash_clear", { repoPath });
}

export async function gitDiscardFile(repoPath: string, file: string): Promise<void> {
  return gitInvoke("git_discard_file", { repoPath, file });
}

export async function gitDiscardAll(repoPath: string): Promise<void> {
  return gitInvoke("git_discard_all", { repoPath });
}

export async function gitDiffRefs(
  repoPath: string,
  from: string,
  to: string
): Promise<FileDiff[]> {
  return gitInvoke("git_diff_refs", { repoPath, from, to });
}

export async function gitDiffMergeBase(
  repoPath: string,
  ref1: string,
  ref2: string
): Promise<FileDiff[]> {
  return gitInvoke("git_diff_merge_base", { repoPath, ref1, ref2 });
}

export async function gitDiscardLines(repoPath: string, file: string, patch: string): Promise<void> {
  return gitInvoke("git_discard_lines", { repoPath, file, patch });
}

export async function gitBlame(
  repoPath: string,
  file: string,
  ignoreWhitespace = false
): Promise<BlameLine[]> {
  return gitInvoke("git_blame", { repoPath, file, ignoreWhitespace });
}

export async function gitGetUserInfo(repoPath: string): Promise<UserInfo> {
  return gitInvoke("git_get_user_info", { repoPath });
}

export async function gitVersion(): Promise<string> {
  return gitInvoke("git_version", {});
}

export async function listenGitProgress(
  handler: (payload: ProgressPayload) => void
): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  return listen<ProgressPayload>("git:progress", (event) => handler(event.payload));
}
