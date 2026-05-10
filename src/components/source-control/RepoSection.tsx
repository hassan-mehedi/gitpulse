import { useState } from "react";
import { Codicon } from "../shared/Codicon";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import { gitDiscardAll, gitStageAll, gitUnstageAll } from "../../lib/git";
import { CommitInput } from "./CommitInput";
import { FileChangeList } from "./FileChangeList";
import { StashSection } from "./StashSection";
import type { Repository } from "../../types/git";

interface RepoSectionProps {
  repo: Repository;
  viewMode: "tree" | "list";
  showRepoHeader: boolean;
  isFirst: boolean;
}

export function RepoSection({
  repo,
  viewMode,
  showRepoHeader,
  isFirst
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

  async function withRefresh(operation: () => Promise<void>) {
    await runGit(async () => {
      await operation();
      await refreshRepo(repo.path);
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
              actions={[
                {
                  icon: "remove",
                  label: "Unstage All Changes",
                  onClick: () => void withRefresh(() => gitUnstageAll(repo.path))
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
              actions={[
                {
                  icon: "discard",
                  label: "Discard All Changes",
                  onClick: () => void withRefresh(() => gitDiscardAll(repo.path))
                },
                {
                  icon: "add",
                  label: "Stage All Changes",
                  onClick: () => void withRefresh(() => gitStageAll(repo.path))
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
