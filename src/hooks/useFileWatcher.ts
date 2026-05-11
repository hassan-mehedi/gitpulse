import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useWorkspaceStore } from "../stores/workspace";

// Coalesce bursts of file-watcher events into one refresh per repo. The Rust
// debouncer already batches at 300 ms, but a single git operation usually fires
// 1-3 separate event names (status-changed + head-changed + remotes-changed)
// back-to-back which would each trigger an independent refresh.
const FRONTEND_REFRESH_DEBOUNCE_MS = 150;

export function useFileWatcher() {
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      return;
    }

    let cancelled = false;
    const disposers: Array<() => void> = [];
    const events = ["repo:status-changed", "repo:head-changed", "repo:remotes-changed"];
    const pendingRefreshTimers = new Map<string, number>();

    function scheduleRefresh(repoPath: string) {
      const existing = pendingRefreshTimers.get(repoPath);
      if (existing !== undefined) {
        window.clearTimeout(existing);
      }
      const timer = window.setTimeout(() => {
        pendingRefreshTimers.delete(repoPath);
        void refreshRepo(repoPath).catch(() => {});
      }, FRONTEND_REFRESH_DEBOUNCE_MS);
      pendingRefreshTimers.set(repoPath, timer);
    }

    void Promise.all(
      events.map((eventName) =>
        listen<{ repoPath: string }>(eventName, (event) => {
          scheduleRefresh(event.payload.repoPath);
        })
      )
    )
      .then((nextDisposers) => {
        if (cancelled) {
          for (const dispose of nextDisposers) {
            dispose();
          }
          return;
        }
        disposers.push(...nextDisposers);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      for (const timer of pendingRefreshTimers.values()) {
        window.clearTimeout(timer);
      }
      pendingRefreshTimers.clear();
      for (const dispose of disposers) {
        dispose();
      }
    };
  }, [refreshRepo]);
}
