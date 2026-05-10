import { useEffect } from "react";
import { gitFetchAll } from "../lib/git";
import { useGit } from "./useGit";
import { useSettingsStore } from "../stores/settings";
import { useWorkspaceStore } from "../stores/workspace";

export function useAutoFetch() {
  const autoFetch = useSettingsStore((state) => state.autoFetch);
  const intervalSeconds = useSettingsStore((state) => state.autoFetchIntervalSeconds);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const runGit = useGit();

  useEffect(() => {
    if (!autoFetch) {
      return;
    }

    const timer = window.setInterval(() => {
      // Read latest repositories from store imperatively to avoid stale closure
      // without making `repositories` a dependency (which would reset the interval
      // on every status update).
      const { repositories } = useWorkspaceStore.getState();
      for (const repo of repositories) {
        void runGit(async () => {
          await gitFetchAll(repo.path);
          await refreshRepo(repo.path);
        });
      }
    }, intervalSeconds * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoFetch, intervalSeconds, refreshRepo, runGit]);
}
