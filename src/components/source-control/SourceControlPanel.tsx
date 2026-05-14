import { useCallback, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { ContextMenu } from "../shared/ContextMenu";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import { useDiffStore } from "../../stores/diff";
import { gitAddToGitignore, gitDiscardFile, gitStageFile, gitUnstageFile } from "../../lib/git";
import {
  openFileInExternalEditor,
  pickRepositoryDirectory,
  pickWorkspaceFile,
  revealFileInManager
} from "../../lib/openTarget";
import { RepoSection } from "./RepoSection";
import type { ActivityView, FileChange, Repository } from "../../types/git";

interface SourceControlPanelProps {
  activeView: ActivityView;
  onOpenBranchPicker: (repo: Repository) => void;
}

interface MenuTarget {
  repo: Repository;
  change: FileChange;
  staged: boolean;
  position: { x: number; y: number };
}

export function SourceControlPanel({
  activeView,
  onOpenBranchPicker
}: SourceControlPanelProps) {
  const repositories = useWorkspaceStore((state) => state.repositories);
  const loadTarget = useWorkspaceStore((state) => state.loadTarget);
  const addTarget = useWorkspaceStore((state) => state.addTarget);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const setActiveRepo = useWorkspaceStore((state) => state.setActiveRepo);
  const openDiff = useWorkspaceStore((state) => state.openDiff);
  const activeChange = useDiffStore((state) => state.activeChange);
  const activeStaged = useDiffStore((state) => state.staged);
  const activeDiffRepo = useDiffStore((state) => state.activeRepo);
  const runGit = useGit();

  const [viewMode, setViewMode] = useState<"tree" | "list">("list");
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);

  const selectedKey = activeChange
    ? `${activeStaged ? "s" : "u"}:${activeDiffRepo?.id ?? "unknown"}:${activeChange.path}`
    : null;

  const handleSelect = useCallback(
    (repo: Repository, change: FileChange, staged: boolean) => {
      setActiveRepo(repo.id);
      runGit(async () => {
        await openDiff(repo, change, staged);
      }).catch(() => {});
    },
    [openDiff, runGit, setActiveRepo]
  );

  const handleStageToggle = useCallback(
    (repo: Repository, change: FileChange, staged: boolean) => {
      setActiveRepo(repo.id);
      runGit(async () => {
        if (staged) {
          await gitUnstageFile(repo.path, change.path);
        } else {
          await gitStageFile(repo.path, change.path);
        }
        await refreshRepo(repo.path);
      }).catch(() => {});
    },
    [refreshRepo, runGit, setActiveRepo]
  );

  const handleDiscard = useCallback(
    (repo: Repository, change: FileChange) => {
      setActiveRepo(repo.id);
      runGit(async () => {
        await gitDiscardFile(repo.path, change.path);
        await refreshRepo(repo.path);
      }).catch(() => {});
    },
    [refreshRepo, runGit, setActiveRepo]
  );

  const handleAddToGitignore = useCallback(
    (repo: Repository, change: FileChange) => {
      setActiveRepo(repo.id);
      runGit(async () => {
        await gitAddToGitignore(repo.path, change.path);
        await refreshRepo(repo.path);
      }).catch(() => {});
    },
    [refreshRepo, runGit, setActiveRepo]
  );

  const handleContextMenu = useCallback(
    (
      repo: Repository,
      change: FileChange,
      staged: boolean,
      position: { x: number; y: number }
    ) => {
      setActiveRepo(repo.id);
      setMenuTarget({ repo, change, staged, position });
    },
    [setActiveRepo]
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

  async function handleAddRepository() {
    const selection = await pickRepositoryDirectory();
    if (!selection) return;
    await addTarget(selection);
  }

  async function handleRefreshAll() {
    await Promise.all(repositories.map((repo) => refreshRepo(repo.path))).catch(() => {});
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
            onClick={() => void handleOpenRepository()}
            title="Open Repository"
            type="button"
          >
            <Codicon name="folder-opened" size={16} />
          </button>
          <button
            className="view-action"
            onClick={() => void handleAddRepository()}
            title="Add Repository"
            type="button"
          >
            <Codicon name="add" size={16} />
          </button>
          <button
            className="view-action"
            onClick={() => void handleOpenWorkspace()}
            title="Open Workspace"
            type="button"
          >
            <Codicon name="folder" size={16} />
          </button>
          <button
            className="view-action"
            onClick={() => void handleRefreshAll()}
            title="Refresh All"
            type="button"
            disabled={repositories.length === 0}
          >
            <Codicon name="refresh" size={16} />
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
            selectedKey={selectedKey}
            onOpenBranchPicker={onOpenBranchPicker}
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
                  label: "Open File in Editor",
                  onSelect: () =>
                    void openFileInExternalEditor(
                      menuTarget.repo.path,
                      menuTarget.change.path
                    )
                },
                {
                  label: "Reveal in File Manager",
                  onSelect: () =>
                    void revealFileInManager(menuTarget.repo.path, menuTarget.change.path)
                },
                {
                  label: menuTarget.staged ? "Unstage Changes" : "Stage Changes",
                  onSelect: () =>
                    handleStageToggle(menuTarget.repo, menuTarget.change, menuTarget.staged)
                },
                {
                  disabled: menuTarget.staged,
                  label: "Add to .gitignore",
                  onSelect: () =>
                    handleAddToGitignore(menuTarget.repo, menuTarget.change)
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
