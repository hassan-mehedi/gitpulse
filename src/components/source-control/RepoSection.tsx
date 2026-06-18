import { useState } from "react";
import { Codicon } from "../shared/Codicon";
import { ConfirmModal } from "../shared/ConfirmModal";
import { Modal } from "../shared/Modal";
import { useGit } from "../../hooks/useGit";
import { useSettingsStore } from "../../stores/settings";
import { useWorkspaceStore } from "../../stores/workspace";
import { useNotificationStore } from "../../stores/notifications";
import { progressId, useProgressStore } from "../../stores/progress";
import { createId } from "../../lib/ids";
import { ignoreReportedError } from "../../lib/errors";
import { branchNeedsPublish, selectPublishRemote, upstreamBranchName } from "../../lib/branches";
import {
  gitDiscardAll,
  gitFetchAll,
  gitListRemotes,
  gitPatchApply,
  gitPatchCreate,
  gitPull,
  gitPush,
  gitPushSetUpstream,
  gitStageAll,
  gitSync,
  gitUnstageAll
} from "../../lib/git";
import { CommitInput } from "./CommitInput";
import { FileChangeList } from "./FileChangeList";
import { StashSection } from "./StashSection";
import { SettingsCheckbox } from "../settings/SettingsPanel";
import type { FileChange, Repository } from "../../types/git";

interface RepoSectionProps {
  repo: Repository;
  viewMode: "tree" | "list";
  showRepoHeader: boolean;
  selectedKey: string | null;
  onOpenBranchPicker: (repo: Repository) => void;
  onSelect: (repo: Repository, change: FileChange, staged: boolean) => void;
  onStageToggle: (repo: Repository, change: FileChange, staged: boolean) => void;
  onDiscard: (repo: Repository, change: FileChange) => void;
  onContextMenu: (
    repo: Repository,
    change: FileChange,
    staged: boolean,
    position: { x: number; y: number }
  ) => void;
}

export function RepoSection({
  repo,
  viewMode,
  showRepoHeader,
  selectedKey,
  onOpenBranchPicker,
  onSelect,
  onStageToggle,
  onDiscard,
  onContextMenu
}: RepoSectionProps) {
  const runGit = useGit();
  const confirmSyncBeforeOperation = useSettingsStore(
    (state) => state.confirmSyncBeforeOperation
  );
  const setConfirmSyncBeforeOperation = useSettingsStore(
    (state) => state.setConfirmSyncBeforeOperation
  );
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const setActiveRepo = useWorkspaceStore((state) => state.setActiveRepo);
  const pushNotification = useNotificationStore((state) => state.pushNotification);
  const upsertProgress = useProgressStore((state) => state.upsertProgress);
  const removeProgress = useProgressStore((state) => state.removeProgress);
  const [collapsed, setCollapsed] = useState(false);
  const [confirmForcePush, setConfirmForcePush] = useState(false);
  const [confirmSync, setConfirmSync] = useState(false);
  const [confirmDiscardAll, setConfirmDiscardAll] = useState(false);

  const conflicted = repo.changes.filter((change) => change.status === "U");
  const regular = repo.changes.filter((change) => change.status !== "U");
  const hasStaged = repo.staged.length > 0;
  const hasConflicts = conflicted.length > 0 || repo.hasConflicts;
  const hasChanges = regular.length > 0;
  const hasStashes = repo.stashCount > 0;
  const isWorkingTreeClean = !hasConflicts && !hasStaged && !hasChanges;
  const currentUpstreamBranch = upstreamBranchName(repo.upstream);
  const hasMismatchedUpstream = Boolean(
    repo.upstream && currentUpstreamBranch && currentUpstreamBranch !== repo.branch
  );
  const canPublishBranch = branchNeedsPublish(repo.branch, repo.upstream);
  const showPublishPrompt = isWorkingTreeClean && canPublishBranch;
  const showSyncPrompt = isWorkingTreeClean && (repo.ahead > 0 || repo.behind > 0);

  function withRefresh(operation: () => Promise<unknown>) {
    runGit(async () => {
      setActiveRepo(repo.id);
      await operation();
      await refreshRepo(repo.path);
    }).catch(ignoreReportedError);
  }

  function requestSync() {
    if (confirmSyncBeforeOperation) {
      setConfirmSync(true);
      return;
    }
    withRefresh(() => syncOperation(repo));
  }

  function publishBranch() {
    withRefresh(async () => {
      const remotes = await gitListRemotes(repo.path);
      const remote = selectPublishRemote(remotes);
      if (!remote) {
        pushNotification({
          id: createId(),
          tone: "error",
          title: "Publish failed",
          message: "No Git remote is configured for this repository."
        });
        return;
      }
      await gitPushSetUpstream(repo.path, remote.name, repo.branch);
    });
  }

  function discardAllWithUndo() {
    withRefresh(async () => {
      const patch = await gitPatchCreate(repo.path, false);
      await gitDiscardAll(repo.path);
      if (patch.patch.trim()) {
        pushNotification({
          id: createId(),
          tone: "info",
          title: "Changes discarded",
          message: `${repo.name}: all unstaged tracked changes`,
          actionLabel: "Undo",
          onAction: () => {
            void runGit(async () => {
              await gitPatchApply(repo.path, patch.patch);
              await refreshRepo(repo.path);
            });
          }
        });
      }
    });
  }

  return (
    <article className="repo-section">
      {showRepoHeader ? (
        <button
          className="repo-section__header"
          onClick={() => setCollapsed((value) => !value)}
          type="button"
        >
          <Codicon name={collapsed ? "chevron-right" : "chevron-down"} size={14} />
          <Codicon name="repo" size={14} />
          <span className="repo-section__meta">
            <span className="repo-section__name" title={repo.name}>
              {repo.name}
            </span>
            <span className="repo-section__path" title={repo.path}>
              {repo.path}
            </span>
            <span className="repo-section__branch" title={repo.branch}>
              <Codicon name="git-branch" size={12} />
              <span className="repo-section__branch-label">{repo.branch}</span>
            </span>
          </span>
          <span
            className="repo-section__actions"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="repo-section__action"
              onClick={() => onOpenBranchPicker(repo)}
              title="Switch Branch"
              aria-label={`Switch branch in ${repo.name}`}
              type="button"
            >
              <Codicon name="git-branch" size={14} />
            </button>
            <button
              className="repo-section__action"
              onClick={() => {
                const toastId = progressId({
                  repoPath: repo.path,
                  operation: "Refresh repository"
                });
                upsertProgress({
                  repoPath: repo.path,
                  operation: "Refresh repository",
                  command: ["git", "status"],
                  message: `Refreshing ${repo.name}…`,
                  status: "running"
                });
                runGit(async () => {
                  setActiveRepo(repo.id);
                  await refreshRepo(repo.path);
                })
                  .catch(ignoreReportedError)
                  .finally(() => removeProgress(toastId));
              }}
              title="Refresh"
              aria-label={`Refresh ${repo.name}`}
              type="button"
            >
              <Codicon name="refresh" size={14} />
            </button>
            <button
              className="repo-section__action"
              onClick={() => withRefresh(() => gitFetchAll(repo.path))}
              title="Fetch"
              aria-label={`Fetch ${repo.name}`}
              type="button"
            >
              <Codicon name="repo-fetch" size={14} />
            </button>
            <button
              className="repo-section__action"
              onClick={() => withRefresh(() => gitPull(repo.path))}
              title="Pull"
              aria-label={`Pull ${repo.name}`}
              type="button"
            >
              <Codicon name="repo-pull" size={14} />
            </button>
            <button
              className="repo-section__action"
              onClick={() => withRefresh(() => gitPush(repo.path))}
              title="Push"
              aria-label={`Push ${repo.name}`}
              type="button"
            >
              <Codicon name="repo-push" size={14} />
            </button>
            <button
              className="repo-section__action"
              onClick={() => setConfirmForcePush(true)}
              title="Force Push With Lease"
              aria-label={`Force push ${repo.name} with lease`}
              type="button"
            >
              <Codicon name="warning" size={14} />
            </button>
            <button
              className="repo-section__action"
              onClick={() => withRefresh(() => gitSync(repo.path))}
              title="Sync"
              aria-label={`Sync ${repo.name}`}
              type="button"
            >
              <Codicon name="sync" size={14} />
            </button>
          </span>
        </button>
      ) : null}
      <ConfirmModal
        isOpen={confirmForcePush}
        title="Force Push With Lease"
        body={
          <>
            Force push <strong>{repo.branch}</strong> using{" "}
            <strong>--force-with-lease</strong>? Remote commits can be overwritten
            if your local tracking ref is stale.
          </>
        }
        confirmLabel="Force Push"
        danger
        onConfirm={() => withRefresh(() => gitPush(repo.path, undefined, undefined, true))}
        onClose={() => setConfirmForcePush(false)}
      />
      <SyncConfirmModal
        isOpen={confirmSync}
        repo={repo}
        onClose={() => setConfirmSync(false)}
        onConfirm={(dontShowAgain) => {
          if (dontShowAgain) {
            setConfirmSyncBeforeOperation(false);
          }
          withRefresh(() => syncOperation(repo));
        }}
      />
      <ConfirmModal
        isOpen={confirmDiscardAll}
        title="Discard All Tracked Changes"
        body="Discard all unstaged tracked changes? They can be restored from the notification that appears after discard."
        confirmLabel="Discard Tracked"
        danger
        onConfirm={discardAllWithUndo}
        onClose={() => setConfirmDiscardAll(false)}
      />

      {!collapsed ? (
        <>
          {showPublishPrompt ? (
            <PublishPrompt
              repo={repo}
              mismatchedUpstream={hasMismatchedUpstream}
              onPublish={publishBranch}
            />
          ) : showSyncPrompt ? (
            <SyncPrompt repo={repo} onSync={requestSync} />
          ) : (
            <CommitInput repo={repo} />
          )}

          <RepoHealthStrip
            repo={repo}
            hasChanges={hasChanges}
            hasConflicts={hasConflicts}
            hasMismatchedUpstream={hasMismatchedUpstream}
            needsPublish={canPublishBranch}
            onPublish={publishBranch}
            onOpenConflicts={() => {
              const firstConflict = conflicted[0];
              if (firstConflict) {
                onSelect(repo, firstConflict, false);
              }
            }}
          />

          {hasConflicts ? (
            <FileChangeList
              changes={conflicted}
              repo={repo}
              staged={false}
              title="Merge Changes"
              count={conflicted.length}
              viewMode={viewMode}
              selectedKey={selectedKey}
              onSelect={onSelect}
              onStageToggle={onStageToggle}
              onDiscard={onDiscard}
              onContextMenu={onContextMenu}
            />
          ) : null}

          {hasStaged ? (
            <FileChangeList
              changes={repo.staged}
              repo={repo}
              staged
              title="Staged Changes"
              count={repo.staged.length}
              viewMode={viewMode}
              selectedKey={selectedKey}
              onSelect={onSelect}
              onStageToggle={onStageToggle}
              onDiscard={onDiscard}
              onContextMenu={onContextMenu}
              actions={[
                {
                  icon: "remove",
                  label: "Unstage All Changes",
                  onClick: () => withRefresh(() => gitUnstageAll(repo.path))
                }
              ]}
            />
          ) : null}

          {hasChanges ? (
            <FileChangeList
              changes={regular}
              repo={repo}
              staged={false}
              title="Changes"
              count={regular.length}
              viewMode={viewMode}
              selectedKey={selectedKey}
              onSelect={onSelect}
              onStageToggle={onStageToggle}
              onDiscard={onDiscard}
              onContextMenu={onContextMenu}
              actions={[
                {
                  icon: "discard",
                  label: "Discard All Tracked Changes",
                  onClick: () => setConfirmDiscardAll(true)
                },
                {
                  icon: "add",
                  label: "Stage All Changes",
                  onClick: () => withRefresh(() => gitStageAll(repo.path))
                }
              ]}
            />
          ) : null}

          {hasStashes ? <StashSection repo={repo} /> : null}
        </>
      ) : null}
    </article>
  );
}

function PublishPrompt({
  repo,
  mismatchedUpstream,
  onPublish
}: {
  repo: Repository;
  mismatchedUpstream: boolean;
  onPublish: () => void;
}) {
  const placeholder = mismatchedUpstream
    ? `Branch '${repo.branch}' tracks '${repo.upstream}'. Publish to a same-name branch instead.`
    : `Branch '${repo.branch}' has no upstream tracking branch`;

  return (
    <div className="scm-sync-prompt">
      <input
        className="scm-sync-prompt__input"
        disabled
        placeholder={placeholder}
      />
      <button
        className="vscode-button vscode-button--primary scm-sync-prompt__button"
        onClick={onPublish}
        title={`Publish ${repo.branch} and set upstream tracking`}
        type="button"
      >
        <Codicon name="repo-push" size={14} />
        <span>{mismatchedUpstream ? "Repair Upstream" : "Publish Branch"}</span>
      </button>
    </div>
  );
}

function syncOperation(repo: Repository) {
  if (branchNeedsPublish(repo.branch, repo.upstream)) {
    return gitSync(repo.path);
  }
  if (repo.ahead > 0 && repo.behind === 0) {
    return gitPush(repo.path);
  }
  if (repo.behind > 0 && repo.ahead === 0) {
    return gitPull(repo.path);
  }
  return gitSync(repo.path);
}

function RepoHealthStrip({
  repo,
  hasChanges,
  hasConflicts,
  hasMismatchedUpstream,
  needsPublish,
  onPublish,
  onOpenConflicts
}: {
  repo: Repository;
  hasChanges: boolean;
  hasConflicts: boolean;
  hasMismatchedUpstream: boolean;
  needsPublish: boolean;
  onPublish: () => void;
  onOpenConflicts: () => void;
}) {
  const items = [];

  if (hasConflicts) {
    items.push({
      key: "conflicts",
      tone: "danger" as const,
      icon: "git-merge" as const,
      label: `${repo.changes.filter((change) => change.status === "U").length || 1} conflict`,
      action: onOpenConflicts
    });
  }

  if (hasMismatchedUpstream) {
    items.push({
      key: "mismatch",
      tone: "warning" as const,
      icon: "warning" as const,
      label: `tracks ${repo.upstream}`,
      action: onPublish
    });
  } else if (needsPublish) {
    items.push({
      key: "publish",
      tone: "warning" as const,
      icon: "repo-push" as const,
      label: "no upstream",
      action: onPublish
    });
  }

  if (repo.ahead > 0 || repo.behind > 0) {
    items.push({
      key: "sync",
      tone: repo.behind > 0 ? ("warning" as const) : ("info" as const),
      icon: "sync" as const,
      label: `${repo.behind}↓ ${repo.ahead}↑`
    });
  }

  if (hasChanges || repo.staged.length > 0) {
    items.push({
      key: "dirty",
      tone: "info" as const,
      icon: "diff" as const,
      label: `${repo.staged.length} staged / ${repo.changes.length} unstaged`
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="repo-health" aria-label={`${repo.name} repository health`}>
      {items.map((item) => {
        const content = (
          <>
            <Codicon name={item.icon} size={12} />
            <span>{item.label}</span>
          </>
        );
        return item.action ? (
          <button
            className={`repo-health__pill repo-health__pill--${item.tone}`}
            key={item.key}
            onClick={item.action}
            type="button"
          >
            {content}
          </button>
        ) : (
          <span className={`repo-health__pill repo-health__pill--${item.tone}`} key={item.key}>
            {content}
          </span>
        );
      })}
    </div>
  );
}

function SyncPrompt({ repo, onSync }: { repo: Repository; onSync: () => void }) {
  const label = syncLabel(repo);
  const title = repo.upstream
    ? `${label} with ${repo.upstream}`
    : `${label}. No upstream tracking branch is configured.`;

  return (
    <div className="scm-sync-prompt">
      <input
        className="scm-sync-prompt__input"
        disabled
        placeholder={`Message (Ctrl+Enter to commit on '${repo.branch}')`}
      />
      <button
        className="vscode-button vscode-button--primary scm-sync-prompt__button"
        disabled={!repo.upstream}
        onClick={onSync}
        title={title}
        type="button"
      >
        <Codicon name="sync" size={14} />
        <span>{label}</span>
      </button>
    </div>
  );
}

function syncLabel(repo: Repository) {
  if (repo.ahead > 0 && repo.behind > 0) {
    return `Sync Changes ${repo.behind}↓ ${repo.ahead}↑`;
  }
  if (repo.ahead > 0) {
    return `Sync Changes ${repo.ahead}↑`;
  }
  return `Pull Changes ${repo.behind}↓`;
}

function SyncConfirmModal({
  isOpen,
  repo,
  onClose,
  onConfirm
}: {
  isOpen: boolean;
  repo: Repository;
  onClose: () => void;
  onConfirm: (dontShowAgain: boolean) => void;
}) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const target = repo.upstream ?? repo.branch;

  return (
    <Modal isOpen={isOpen} title="Sync Changes" onClose={onClose}>
      <div className="confirm-modal">
        <div className="confirm-modal__body">
          Do you want to sync changes to branch <strong>{target}</strong>?
        </div>
        <label className="confirm-modal__checkbox">
          <SettingsCheckbox checked={dontShowAgain} onChange={setDontShowAgain} />
          <span>Don't show again</span>
        </label>
        <div className="confirm-modal__actions">
          <button className="vscode-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="vscode-button vscode-button--primary"
            onClick={() => {
              onConfirm(dontShowAgain);
              onClose();
            }}
            type="button"
          >
            OK
          </button>
        </div>
      </div>
    </Modal>
  );
}
