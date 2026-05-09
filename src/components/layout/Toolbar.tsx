import { Bell, Download, RefreshCcw, RotateCw, Settings2, Upload } from "lucide-react";
import { RepoSelector } from "./RepoSelector";
import { useRepo } from "../../hooks/useRepo";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import { gitFetchAll, gitPull, gitPush, gitSync } from "../../lib/git";
import type { ActivityView } from "../../types/git";

interface ToolbarProps {
  activeView: ActivityView;
  onNavigate: (view: ActivityView) => void;
}

export function Toolbar({ onNavigate }: ToolbarProps) {
  const { activeRepo } = useRepo();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const runGit = useGit();

  async function handleFetch() {
    if (!activeRepo) {
      return;
    }

    await runGit(async () => {
      await gitFetchAll(activeRepo.path);
      await refreshRepo(activeRepo.path);
    });
  }

  async function handlePull() {
    if (!activeRepo) {
      return;
    }

    await runGit(async () => {
      await gitPull(activeRepo.path);
      await refreshRepo(activeRepo.path);
    });
  }

  async function handlePush() {
    if (!activeRepo) {
      return;
    }

    await runGit(async () => {
      await gitPush(activeRepo.path);
      await refreshRepo(activeRepo.path);
    });
  }

  async function handleSync() {
    if (!activeRepo) {
      return;
    }

    await runGit(async () => {
      await gitSync(activeRepo.path);
      await refreshRepo(activeRepo.path);
    });
  }

  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <div className="toolbar__brand-mark">GP</div>
        <div>
          <div className="toolbar__title">GitPulse</div>
          <div className="toolbar__subtitle">
            {activeRepo ? activeRepo.path : "Open a repo or workspace target to begin"}
          </div>
        </div>
      </div>

      <div className="toolbar__repo">
        <RepoSelector />
      </div>

      <div className="toolbar__actions">
        <button className="panel-button" disabled={!activeRepo} onClick={() => void handleFetch()} type="button">
          <RefreshCcw size={16} />
          Fetch
        </button>
        <button className="panel-button" disabled={!activeRepo} onClick={() => void handlePull()} type="button">
          <Download size={16} />
          Pull
        </button>
        <button className="panel-button" disabled={!activeRepo} onClick={() => void handlePush()} type="button">
          <Upload size={16} />
          Push
        </button>
        <button className="panel-button" disabled={!activeRepo} onClick={() => void handleSync()} type="button">
          <RotateCw size={16} />
          Sync
        </button>
        <button className="icon-button" type="button">
          <Bell size={16} />
        </button>
        <button className="icon-button" onClick={() => onNavigate("settings")} type="button">
          <Settings2 size={16} />
        </button>
      </div>
    </header>
  );
}
