import { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { listenGitProgress } from "./lib/git";
import { useWorkspaceStore } from "./stores/workspace";
import { useSettingsStore } from "./stores/settings";
import { useNotificationStore } from "./stores/notifications";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { applyTheme } from "./lib/theme";
import { useAutoFetch } from "./hooks/useAutoFetch";

export default function App() {
  const initialize = useWorkspaceStore((state) => state.initialize);
  const theme = useSettingsStore((state) => state.theme);
  const pushNotification = useNotificationStore((state) => state.pushNotification);

  useFileWatcher();
  useAutoFetch();

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

    let dispose: (() => void) | undefined;
    void listenGitProgress((payload) => {
      if (payload.status !== "completed" && payload.status !== "failed") {
        return;
      }

      pushNotification({
        id: crypto.randomUUID(),
        tone: payload.status === "failed" ? "error" : "info",
        title: `${payload.operation} ${payload.status}`,
        message: payload.message
      });
    }).then((unlisten) => {
      dispose = unlisten;
    });

    return () => {
      dispose?.();
    };
  }, [pushNotification]);

  return <AppShell />;
}
