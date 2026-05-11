import { useCallback, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { ContextMenu } from "../shared/ContextMenu";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import { useDiffStore } from "../../stores/diff";
import {
  gitDiscardFile,
  gitFetchAll,
  gitPull,
  gitPush,
  gitStageFile,
  gitSync,
  gitUnstageFile
} from "../../lib/git";
import { pickRepositoryDirectory, pickWorkspaceFile } from "../../lib/openTarget";
import { RepoSection } from "./RepoSection";
import type { ActivityView, FileChange, Repository } from "../../types/git";

interface SourceControlPanelProps {
  activeView: ActivityView;
}

interface MenuTarget {
  repo: Repository;
  change: FileChange;
  staged: boolean;
  position: { x: number; y: number };
}

export function SourceControlPanel({ activeView }: SourceControlPanelProps) {
  const repositories = useWorkspaceStore((state) => state.repositories);
  const loadTarget = useWorkspaceStore((state) => state.loadTarget);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const openDiff = useWorkspaceStore((state) => state.openDiff);
  const activeChange = useDiffStore((state) => state.activeChange);
  const activeStaged = useDiffStore((state) => state.staged);
  const runGit = useGit();

  const [viewMode, setViewMode] = useState<"tree" | "list">("list");
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);

  const activeRepo = repositories[0] ?? null;
  const selectedKey = activeChange
    ? `${activeStaged ? "s" : "u"}:${activeChange.path}`
    : null;

  const handleSelect = useCallback(
    (repo: Repository, change: FileChange, staged: boolean) => {
      runGit(async () => {
        await openDiff(repo, change, staged);
      }).catch(() => {});
    },
    [openDiff, runGit]
  );

  const handleStageToggle = useCallback(
    (repo: Repository, change: FileChange, staged: boolean) => {
      runGit(async () => {
        if (staged) {
          await gitUnstageFile(repo.path, change.path);
        } else {
          await gitStageFile(repo.path, change.path);
        }
        await refreshRepo(repo.path);
      }).catch(() => {});
    },
    [refreshRepo, runGit]
  );

  const handleDiscard = useCallback(
    (repo: Repository, change: FileChange) => {
      runGit(async () => {
        await gitDiscardFile(repo.path, change.path);
        await refreshRepo(repo.path);
      }).catch(() => {});
    },
    [refreshRepo, runGit]
  );

  const handleContextMenu = useCallback(
    (
      repo: Repository,
      change: FileChange,
      staged: boolean,
      position: { x: number; y: number }
    ) => {
      setMenuTarget({ repo, change, staged, position });
    },
    []
  );

  async function handleOpenRepository() {
    const selection = await pickRepositoryDirectory();
    if (!selection) return;
    await loadTarget(selection);
  }

  async function handleOpenWorkspace() {
    const selection = await pickWorkspaceFile();
    if (!selection) return;
    await loadTarget(selection);
  }

  async function withActiveRepo(operation: (repoPath: string) => Promise<unknown>) {
    if (!activeRepo) return;
    await runGit(async () => {
      await operation(activeRepo.path);
      await refreshRepo(activeRepo.path);
    }).catch(() => {});
  }

  if (activeView !== "source-control") {
    return (
      <div className="empty-state">
        <div className="empty-state__title">View not implemented yet</div>
        <div className="empty-state__body">
          The shell is ready for {activeView}.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="view-title">
        <h2 className="view-title__label">Source Control</h2>
        <div className="view-title__actions">
          <button
            className="view-action"
            onClick={() => activeRepo && void refreshRepo(activeRepo.path)}
            title="Refresh"
            type="button"
            disabled={!activeRepo}
          >
            <Codicon name="refresh" size={16} />
          </button>
          <button
            className="view-action"
            onClick={() => void withActiveRepo(gitFetchAll)}
            title="Fetch"
            type="button"
            disabled={!activeRepo}
          >
            <Codicon name="repo-fetch" size={16} />
          </button>
          <button
            className="view-action"
            onClick={() => void withActiveRepo(gitPull)}
            title="Pull"
            type="button"
            disabled={!activeRepo}
          >
            <Codicon name="repo-pull" size={16} />
          </button>
          <button
            className="view-action"
            onClick={() => void withActiveRepo(gitPush)}
            title="Push"
            type="button"
            disabled={!activeRepo}
          >
            <Codicon name="repo-push" size={16} />
          </button>
          <button
            className="view-action"
            onClick={() => void withActiveRepo(gitSync)}
            title="Sync"
            type="button"
            disabled={!activeRepo}
          >
            <Codicon name="sync" size={16} />
          </button>
          <button
            className="view-action"
            onClick={() => setViewMode((value) => (value === "list" ? "tree" : "list"))}
            title={viewMode === "list" ? "View as Tree" : "View as List"}
            type="button"
          >
            <Codicon name={viewMode === "list" ? "list-tree" : "list-flat"} size={16} />
          </button>
        </div>
      </div>

      <div className="scm-body">
        {repositories.length === 0 ? (
          <div className="scm-welcome">
            <p className="scm-welcome__lead">
              In order to use Source Control, you can open a folder containing a Git repository or
              clone from a URL.
            </p>
            <button
              className="vscode-button vscode-button--primary"
              onClick={() => void handleOpenRepository()}
              type="button"
            >
              Open Folder
            </button>
            <button
              className="vscode-button"
              onClick={() => void handleOpenWorkspace()}
              type="button"
            >
              Open Workspace
            </button>
          </div>
        ) : null}
        {repositories.map((repo, index) => (
          <RepoSection
            key={repo.id}
            repo={repo}
            viewMode={viewMode}
            showRepoHeader={repositories.length > 1}
            isFirst={index === 0}
            selectedKey={selectedKey}
            onSelect={handleSelect}
            onStageToggle={handleStageToggle}
            onDiscard={handleDiscard}
            onContextMenu={handleContextMenu}
          />
        ))}
      </div>

      <ContextMenu
        items={
          menuTarget
            ? [
                {
                  label: "Open Diff",
                  onSelect: () =>
                    handleSelect(menuTarget.repo, menuTarget.change, menuTarget.staged)
                },
                {
                  label: menuTarget.staged ? "Unstage Changes" : "Stage Changes",
                  onSelect: () =>
                    handleStageToggle(menuTarget.repo, menuTarget.change, menuTarget.staged)
                },
                {
                  danger: true,
                  disabled: menuTarget.staged,
                  label: "Discard Changes",
                  onSelect: () => handleDiscard(menuTarget.repo, menuTarget.change)
                }
              ]
            : []
        }
        position={menuTarget?.position ?? null}
        onClose={() => setMenuTarget(null)}
      />
    </>
  );
}
