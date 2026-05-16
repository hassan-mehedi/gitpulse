import { useEffect } from "react";
import { gitFetchAll } from "../lib/git";
import { useGit } from "./useGit";
import { useSettingsStore } from "../stores/settings";
import { useWorkspaceStore } from "../stores/workspace";
import { reportBackgroundError } from "../lib/errors";

export function useAutoFetch() {
  const autoFetch = useSettingsStore((state) => state.autoFetch);
  const intervalSeconds = useSettingsStore((state) => state.autoFetchIntervalSeconds);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const runGit = useGit();

  useEffect(() => {
    if (!autoFetch) {
      return;
    }

    let running = false;
    const timer = window.setInterval(() => {
      if (running) return;
      running = true;
      // Read latest repositories from store imperatively to avoid stale closure
      // without making `repositories` a dependency (which would reset the interval
      // on every status update).
      const { repositories } = useWorkspaceStore.getState();
      void (async () => {
        for (const repo of repositories) {
          await runGit(async () => {
            await gitFetchAll(repo.path);
            await refreshRepo(repo.path);
          }).catch((error) => {
            reportBackgroundError(error, {
              operation: "Auto fetch",
              repoPath: repo.path,
              title: "Auto fetch failed",
              notify: false
            });
          });
        }
      })().finally(() => {
        running = false;
      });
    }, intervalSeconds * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoFetch, intervalSeconds, refreshRepo, runGit]);
}
