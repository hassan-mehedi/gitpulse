import { useMemo } from "react";
import { Codicon } from "../shared/Codicon";
import { useRepo } from "../../hooks/useRepo";
import { useGit } from "../../hooks/useGit";
import { useProgressStore } from "../../stores/progress";
import { useNotificationStore } from "../../stores/notifications";
import { useWorkspaceStore } from "../../stores/workspace";
import { gitFetchAll, gitSync } from "../../lib/git";

interface StatusBarProps {
  onOpenBranchPicker?: () => void;
}

export function StatusBar({ onOpenBranchPicker }: StatusBarProps) {
  const { activeRepo } = useRepo();
  const runGit = useGit();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const progressItems = useProgressStore((state) => state.items);
  const notifications = useNotificationStore((state) => state.items);

  const activeProgress = useMemo(
    () => [...progressItems].sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null,
    [progressItems]
  );

  async function handleSync() {
    if (!activeRepo) {
      return;
    }
    await runGit(async () => {
      await gitSync(activeRepo.path);
      await refreshRepo(activeRepo.path);
    });
  }

  async function handleFetch() {
    if (!activeRepo) {
      return;
    }
    await runGit(async () => {
      await gitFetchAll(activeRepo.path);
      await refreshRepo(activeRepo.path);
    });
  }

  const hasRepo = Boolean(activeRepo);
  const ahead = activeRepo?.ahead ?? 0;
  const behind = activeRepo?.behind ?? 0;
  const isOperationActive =
    activeProgress?.status === "started" || activeProgress?.status === "running";

  return (
    <footer className="status-bar" role="status">
      <div className="status-bar__cluster">
        {hasRepo ? (
          <>
            <button
              className="status-bar__item"
              onClick={onOpenBranchPicker}
              type="button"
              title="Switch branch"
            >
              <Codicon name="source-control" size={14} />
              <span>{activeRepo!.branch}</span>
            </button>
            <button
              className="status-bar__item"
              onClick={() => void handleSync()}
              type="button"
              title={
                activeRepo!.upstream
                  ? `Sync with ${activeRepo!.upstream}`
                  : "No upstream tracking"
              }
              disabled={!activeRepo!.upstream}
            >
              <Codicon name="sync" size={13} spin={isOperationActive} />
              <span>
                {behind} <Codicon name="arrow-down" size={11} /> {ahead}{" "}
                <Codicon name="arrow-up" size={11} />
              </span>
            </button>
            <button
              className="status-bar__item"
              onClick={() => void handleFetch()}
              type="button"
              title="Fetch all remotes"
            >
              <Codicon name="repo-fetch" size={13} />
            </button>
          </>
        ) : (
          <span className="status-bar__item status-bar__item--static">
            <Codicon name="folder" size={13} />
            <span>No folder open</span>
          </span>
        )}
      </div>

      <div className="status-bar__cluster status-bar__cluster--right">
        {isOperationActive ? (
          <span className="status-bar__item status-bar__item--static">
            <Codicon name="sync" size={13} spin />
            <span>{activeProgress!.message}</span>
          </span>
        ) : null}
        <span className="status-bar__item status-bar__item--static" title="Encoding">
          UTF-8
        </span>
        <span className="status-bar__item status-bar__item--static" title="Line endings">
          LF
        </span>
        <button
          className="status-bar__item"
          type="button"
          title={`${notifications.length} notification${notifications.length === 1 ? "" : "s"}`}
        >
          <Codicon name={notifications.length > 0 ? "bell-dot" : "bell"} size={13} />
        </button>
      </div>
    </footer>
  );
}
