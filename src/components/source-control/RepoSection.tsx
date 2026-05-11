import { useState } from "react";
import { Codicon } from "../shared/Codicon";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import { gitDiscardAll, gitStageAll, gitUnstageAll } from "../../lib/git";
import { CommitInput } from "./CommitInput";
import { FileChangeList } from "./FileChangeList";
import { StashSection } from "./StashSection";
import type { FileChange, Repository } from "../../types/git";

interface RepoSectionProps {
  repo: Repository;
  viewMode: "tree" | "list";
  showRepoHeader: boolean;
  isFirst: boolean;
  selectedKey: string | null;
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
  isFirst,
  selectedKey,
  onSelect,
  onStageToggle,
  onDiscard,
  onContextMenu
}: RepoSectionProps) {
  const runGit = useGit();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const [collapsed, setCollapsed] = useState(false);

  const conflicted = repo.changes.filter((change) => change.status === "U");
  const regular = repo.changes.filter((change) => change.status !== "U");
  const hasStaged = repo.staged.length > 0;
  const hasConflicts = conflicted.length > 0 || repo.hasConflicts;
  const hasChanges = regular.length > 0;
  const hasStashes = repo.stashCount > 0;

  function withRefresh(operation: () => Promise<unknown>) {
    runGit(async () => {
      await operation();
      await refreshRepo(repo.path);
    }).catch(() => {});
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
          <span className="repo-section__name">{repo.name}</span>
          <span className="repo-section__branch">{repo.branch}</span>
        </button>
      ) : null}

      {!collapsed ? (
        <>
          {isFirst ? <CommitInput repo={repo} /> : null}

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
                  label: "Discard All Changes",
                  onClick: () => withRefresh(() => gitDiscardAll(repo.path))
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
