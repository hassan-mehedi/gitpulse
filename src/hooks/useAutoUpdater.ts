import { useEffect } from "react";
import { useNotificationStore } from "../stores/notifications";
import { createId } from "../lib/ids";
import { isTauriRuntime } from "../lib/runtime";
import { reportBackgroundError } from "../lib/errors";

export function useAutoUpdater() {
  const pushNotification = useNotificationStore((state) => state.pushNotification);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let cancelled = false;

    void (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (cancelled || !update) return;

        pushNotification({
          id: createId(),
          title: `Update available: v${update.version}`,
          message: update.body ?? "A new version of GitPulse is ready to install.",
          tone: "info",
          actionLabel: "Install & Restart",
          onAction: () => {
            void (async () => {
              try {
                await update.downloadAndInstall();
                const { relaunch } = await import("@tauri-apps/plugin-process");
                await relaunch();
              } catch (err) {
                reportBackgroundError(err, {
                  operation: "updater:install",
                  title: "Failed to install update"
                });
              }
            })();
          }
        });
      } catch (err) {
        reportBackgroundError(err, {
          operation: "updater:check",
          title: "Update check failed",
          notify: false
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pushNotification]);
}
