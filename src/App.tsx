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
import { useOutputStore } from "./stores/output";
import { isTauriRuntime } from "./lib/runtime";
import { reportBackgroundError } from "./lib/errors";

export default function App() {
  const initialize = useWorkspaceStore((state) => state.initialize);
  const theme = useSettingsStore((state) => state.theme);
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  const pushNotification = useNotificationStore((state) => state.pushNotification);
  const upsertProgress = useProgressStore((state) => state.upsertProgress);
  const removeProgress = useProgressStore((state) => state.removeProgress);
  const setGitVersion = useRuntimeStore((state) => state.setGitVersion);
  const pushOutput = useOutputStore((state) => state.pushOutput);

  useFileWatcher();
  useAutoFetch();

  useEffect(() => {
    function onOutput(event: Event) {
      pushOutput((event as CustomEvent<import("./types/git").ProgressPayload>).detail);
    }

    window.addEventListener("gitpulse:output", onOutput);
    return () => {
      window.removeEventListener("gitpulse:output", onOutput);
    };
  }, [pushOutput]);

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
    if (!isTauriRuntime()) {
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
      pushOutput(payload);
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
      .catch((error) => {
        reportBackgroundError(error, {
          operation: "Listen for Git progress",
          title: "Git progress listener failed"
        });
      });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [pushNotification, pushOutput, removeProgress, setGitVersion, upsertProgress]);

  return <AppShell />;
}
