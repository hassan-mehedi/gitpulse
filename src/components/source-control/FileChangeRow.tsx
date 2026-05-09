import { Eye, Minus, Plus, RotateCcw } from "lucide-react";
import { gitDiscardFile, gitStageFile, gitUnstageFile } from "../../lib/git";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import { useDiffStore } from "../../stores/diff";
import type { FileChange, Repository } from "../../types/git";

interface FileChangeRowProps {
  repo: Repository;
  change: FileChange;
  staged: boolean;
}

const statusColor: Record<string, string> = {
  A: "var(--success)",
  M: "var(--warning)",
  D: "var(--danger)",
  R: "var(--accent)",
  "?": "var(--text-muted)",
  U: "var(--danger)"
};

export function FileChangeRow({ repo, change, staged }: FileChangeRowProps) {
  const runGit = useGit();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const openDiff = useWorkspaceStore((state) => state.openDiff);
  const activeChange = useDiffStore((state) => state.activeChange);

  const segments = change.path.split("/");
  const name = segments.pop() ?? change.path;
  const parentPath = segments.join("/");

  async function handleStageToggle() {
    await runGit(async () => {
      if (staged) {
        await gitUnstageFile(repo.path, change.path);
      } else {
        await gitStageFile(repo.path, change.path);
      }
      await refreshRepo(repo.path);
    });
  }

  async function handleDiscard() {
    await runGit(async () => {
      await gitDiscardFile(repo.path, change.path);
      await refreshRepo(repo.path);
    });
  }

  return (
    <div className={`file-row ${activeChange?.path === change.path ? "is-active" : ""}`}>
      <div className="file-row__left">
        <div className="badge" style={{ color: statusColor[change.status] ?? "var(--accent)" }}>
          {change.status}
        </div>
        <div>
          <div className="file-row__name">{name}</div>
          <div className="file-row__path">{parentPath || "."}</div>
        </div>
      </div>
      <div className="file-row__actions">
        <button className="icon-button" onClick={() => void openDiff(repo, change, staged)} type="button">
          <Eye size={14} />
        </button>
        <button className="icon-button" onClick={() => void handleStageToggle()} type="button">
          {staged ? <Minus size={14} /> : <Plus size={14} />}
        </button>
        {!staged ? (
          <button className="icon-button" onClick={() => void handleDiscard()} type="button">
            <RotateCcw size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
