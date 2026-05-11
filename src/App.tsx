import { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { gitVersion, listenGitProgress } from "./lib/git";
import { useWorkspaceStore } from "./stores/workspace";
import { useSettingsStore } from "./stores/settings";
import { useNotificationStore } from "./stores/notifications";
import { progressId, useProgressStore } from "./stores/progress";
import { useRuntimeStore } from "./stores/runtime";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { applyTheme } from "./lib/theme";
import { useAutoFetch } from "./hooks/useAutoFetch";
import { createId } from "./lib/ids";

export default function App() {
  const initialize = useWorkspaceStore((state) => state.initialize);
  const theme = useSettingsStore((state) => state.theme);
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  const pushNotification = useNotificationStore((state) => state.pushNotification);
  const upsertProgress = useProgressStore((state) => state.upsertProgress);
  const removeProgress = useProgressStore((state) => state.removeProgress);
  const setGitVersion = useRuntimeStore((state) => state.setGitVersion);

  useFileWatcher();
  useAutoFetch();

  useEffect(() => {
    void hydrateSettings();
  }, [hydrateSettings]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      return;
    }

    void gitVersion()
      .then((version) => setGitVersion(version))
      .catch((error: { message?: string }) => {
        setGitVersion(null);
        pushNotification({
          id: createId(),
          tone: "error",
          title: "Git unavailable",
          message: error.message ?? "Git version check failed."
        });
      });

    let cancelled = false;
    let dispose: (() => void) | undefined;
    void listenGitProgress((payload) => {
      upsertProgress(payload);

      if (payload.status === "completed" || payload.status === "failed") {
        window.setTimeout(() => {
          removeProgress(progressId(payload));
        }, 3200);
      }

      if (payload.status !== "completed" && payload.status !== "failed") {
        return;
      }

      pushNotification({
        id: createId(),
        tone: payload.status === "failed" ? "error" : "info",
        title: `${payload.operation} ${payload.status}`,
        message: payload.message
      });
    })
      .then((unlisten) => {
        if (cancelled) {
          // Effect was torn down before the listener registered — dispose now.
          unlisten();
          return;
        }
        dispose = unlisten;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [pushNotification, removeProgress, setGitVersion, upsertProgress]);

  return <AppShell />;
}
