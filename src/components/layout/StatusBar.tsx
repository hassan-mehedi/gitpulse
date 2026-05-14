import { useEffect, useMemo, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { useRepo } from "../../hooks/useRepo";
import { useGit } from "../../hooks/useGit";
import { useProgressStore } from "../../stores/progress";
import { useNotificationStore } from "../../stores/notifications";
import { useWorkspaceStore } from "../../stores/workspace";
import { useInlineBlameStore } from "../../stores/inlineBlame";
import { useSettingsStore } from "../../stores/settings";
import { resolveCommitIdentity } from "../../lib/commitIdentity";
import { gitFetchAll, gitGetUserInfo, gitSync } from "../../lib/git";
import type { UserInfo } from "../../types/git";

interface StatusBarProps {
  onOpenBranchPicker?: () => void;
}

function formatRelativeBlame(unixOrIso: string): string {
  // The blame parser emits author-time as a unix timestamp.
  const asNumber = Number(unixOrIso);
  const seconds = Number.isFinite(asNumber) && asNumber > 0
    ? Math.floor(Date.now() / 1000) - asNumber
    : Math.floor((Date.now() - Date.parse(unixOrIso)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return unixOrIso;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 86_400 * 7) return `${Math.floor(seconds / 86_400)} days ago`;
  if (seconds < 86_400 * 30)
    return `${Math.floor(seconds / (86_400 * 7))} weeks ago`;
  if (seconds < 86_400 * 365)
    return `${Math.floor(seconds / (86_400 * 30))} months ago`;
  return `${Math.floor(seconds / (86_400 * 365))} years ago`;
}

export function StatusBar({ onOpenBranchPicker }: StatusBarProps) {
  const { activeRepo } = useRepo();
  const runGit = useGit();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const progressItems = useProgressStore((state) => state.items);
  const notifications = useNotificationStore((state) => state.items);
  const blame = useInlineBlameStore((state) => state.result);
  const commitIdentities = useSettingsStore((state) => state.commitIdentities);
  const repoIdentityAssignments = useSettingsStore((state) => state.repoIdentityAssignments);
  const [gitUser, setGitUser] = useState<UserInfo | null>(null);

  const activeProgress = useMemo(
    () => [...progressItems].sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null,
    [progressItems]
  );

  useEffect(() => {
    if (!activeRepo) {
      setGitUser(null);
      return;
    }
    let cancelled = false;
    void gitGetUserInfo(activeRepo.path)
      .then((user) => {
        if (!cancelled) setGitUser(user);
      })
      .catch(() => {
        if (!cancelled) setGitUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRepo]);

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
  const effectiveIdentity = resolveCommitIdentity(
    activeRepo?.path,
    commitIdentities,
    repoIdentityAssignments,
    gitUser
  );

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
        {hasRepo ? (
          <span
            className="status-bar__item status-bar__item--static status-bar__identity"
            title={
              effectiveIdentity.source === "gitpulse"
                ? "GitPulse commit identity for this repository"
                : effectiveIdentity.source === "git-config"
                  ? "Git config commit identity"
                  : "No commit identity configured"
            }
          >
            <Codicon name="account" size={13} />
            <span>{effectiveIdentity.label}</span>
          </span>
        ) : null}
        {blame ? (
          <span
            className="status-bar__item status-bar__item--static status-bar__blame"
            title={`${blame.author} · ${blame.summary} · ${blame.sha.slice(0, 7)}`}
          >
            <Codicon name="git-commit" size={13} />
            <span>
              {blame.author || "Unknown"} ({formatRelativeBlame(blame.date)})
            </span>
          </span>
        ) : null}
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
