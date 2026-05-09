import { AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";
import { gitStageAll } from "../../lib/git";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import { CommitInput } from "./CommitInput";
import { FileChangeList } from "./FileChangeList";
import type { Repository } from "../../types/git";

interface RepoSectionProps {
  repo: Repository;
  viewMode: "tree" | "list";
}

export function RepoSection({ repo, viewMode }: RepoSectionProps) {
  const runGit = useGit();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);

  async function handleStageAll() {
    await runGit(async () => {
      await gitStageAll(repo.path);
      await refreshRepo(repo.path);
    });
  }

  return (
    <article className="repo-card">
      <div className="repo-card__header">
        <div>
          <div>{repo.name}</div>
          <div className="repo-card__meta">
            <span>{repo.branch}</span>
            {repo.upstream ? <span>{repo.upstream}</span> : null}
          </div>
        </div>
        <div className="repo-card__meta">
          <div className="badge">
            <ArrowUp size={13} />
            {repo.ahead}
          </div>
          <div className="badge">
            <ArrowDown size={13} />
            {repo.behind}
          </div>
          {repo.hasConflicts ? (
            <div className="badge">
              <AlertTriangle size={13} />
              Conflicts
            </div>
          ) : null}
        </div>
      </div>

      <div className="repo-card__body">
        <CommitInput repo={repo} />
        <FileChangeList
          changes={repo.staged}
          repo={repo}
          staged
          title={`Staged (${repo.staged.length})`}
          viewMode={viewMode}
        />
        <FileChangeList
          action={
            repo.changes.length > 0 ? (
              <button className="panel-button" onClick={() => void handleStageAll()} type="button">
                Stage All
              </button>
            ) : null
          }
          changes={repo.changes}
          repo={repo}
          staged={false}
          title={`Changes (${repo.changes.length})`}
          viewMode={viewMode}
        />
      </div>
    </article>
  );
}
