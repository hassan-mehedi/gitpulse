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
        pushNotification({
          id: createId(),
          tone: "error",
          title: "Git operation failed",
          message: gitError.message ?? gitError.stderr ?? gitError.kind
        });
        throw gitError;
      }
    },
    [pushNotification]
  );
}
