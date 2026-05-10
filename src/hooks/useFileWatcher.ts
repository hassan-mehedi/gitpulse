import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useWorkspaceStore } from "../stores/workspace";

export function useFileWatcher() {
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      return;
    }

    const disposers: Array<() => void> = [];
    const events = ["repo:status-changed", "repo:head-changed", "repo:remotes-changed"];

    void Promise.all(
      events.map((eventName) =>
        listen<{ repoPath: string }>(eventName, (event) => {
          void refreshRepo(event.payload.repoPath).catch(() => {});
        })
      )
    ).then((nextDisposers) => {
      disposers.push(...nextDisposers);
    });

    return () => {
      for (const dispose of disposers) {
        dispose();
      }
    };
  }, [refreshRepo]);
}
