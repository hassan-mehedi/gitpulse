import { useCallback } from "react";
import { useNotificationStore } from "../stores/notifications";
import type { GitError } from "../types/git";
import { createId } from "../lib/ids";

export function useGit() {
  const pushNotification = useNotificationStore((state) => state.pushNotification);

  return useCallback(
    async <T,>(operation: () => Promise<T>) => {
      try {
        return await operation();
      } catch (error) {
        const gitError = error as GitError;
        const detail = gitError.message ?? gitError.stderr ?? gitError.kind ?? String(error);
        // Surface to console so the user can grep for it; the toast is the user-facing path.
        if (typeof console !== "undefined") {
          console.error("[git] operation failed:", error);
        }
        pushNotification({
          id: createId(),
          tone: "error",
          title: "Git operation failed",
          message: detail
        });
        throw gitError;
      }
    },
    [pushNotification]
  );
}
