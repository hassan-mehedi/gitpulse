import { useEffect } from "react";
import { gitFetchAll } from "../lib/git";
import { useGit } from "./useGit";
import { useSettingsStore } from "../stores/settings";
import { useWorkspaceStore } from "../stores/workspace";
import { reportBackgroundError } from "../lib/errors";

// Cap concurrent network Git operations so a multi-repo workspace doesn't fan
// out one connection per repo at the same tick.
const MAX_CONCURRENT_FETCHES = 3;

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
        let cursor = 0;
        const fetchOne = async () => {
          while (true) {
            const index = cursor++;
            if (index >= repositories.length) return;
            const repo = repositories[index]!;
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
        };
        const workers = Array.from(
          { length: Math.min(MAX_CONCURRENT_FETCHES, repositories.length) },
          fetchOne
        );
        await Promise.all(workers);
      })().finally(() => {
        running = false;
      });
    }, intervalSeconds * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoFetch, intervalSeconds, refreshRepo, runGit]);
}
