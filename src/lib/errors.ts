import { createId } from "./ids";
import { useNotificationStore } from "../stores/notifications";
import { useOutputStore } from "../stores/output";
import type { GitError, ProgressPayload } from "../types/git";

interface ErrorReportOptions {
  operation: string;
  repoPath?: string;
  title?: string;
  notify?: boolean;
}

export function errorMessage(error: unknown) {
  const gitError = error as Partial<GitError>;
  return gitError.message ?? gitError.stderr ?? gitError.kind ?? String(error);
}

export function reportBackgroundError(error: unknown, options: ErrorReportOptions) {
  const message = errorMessage(error);
  const payload: ProgressPayload = {
    repoPath: options.repoPath ?? "",
    operation: options.operation,
    command: [],
    message,
    status: "failed"
  };

  if (typeof console !== "undefined") {
    console.error(`[${options.operation}] failed:`, error);
  }

  useOutputStore.getState().pushOutput(payload);

  if (options.notify ?? true) {
    useNotificationStore.getState().pushNotification({
      id: createId(),
      tone: "error",
      title: options.title ?? `${options.operation} failed`,
      message
    });
  }
}

// `useGit` already reports user-facing failures. Use this when the caller only
// needs to stop promise propagation after that shared reporting has happened.
export function ignoreReportedError() {}
