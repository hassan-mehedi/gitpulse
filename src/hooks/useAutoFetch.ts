import { useEffect } from "react";
import { gitFetchAll } from "../lib/git";
import { useGit } from "./useGit";
import { useSettingsStore } from "../stores/settings";
import { useWorkspaceStore } from "../stores/workspace";

export function useAutoFetch() {
  const autoFetch = useSettingsStore((state) => state.autoFetch);
  const intervalSeconds = useSettingsStore((state) => state.autoFetchIntervalSeconds);
  const repositories = useWorkspaceStore((state) => state.repositories);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const runGit = useGit();

  useEffect(() => {
    if (!autoFetch || repositories.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
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
  }, [autoFetch, intervalSeconds, refreshRepo, repositories, runGit]);
}
