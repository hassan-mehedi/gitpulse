import type { LfsLockInfo, LfsStatus, SparseCheckoutStatus, SubmoduleInfo } from "../types/git";

export function submoduleStatusMeta(submodule: SubmoduleInfo) {
  switch (submodule.status) {
    case "-":
      return { label: "Not initialized", tone: "warning" as const };
    case "+":
      return { label: "Checked out at different commit", tone: "warning" as const };
    case "U":
      return { label: "Merge conflict", tone: "danger" as const };
    default:
      return { label: "Initialized", tone: "success" as const };
  }
}

export function summarizeSparseCheckout(status: SparseCheckoutStatus) {
  if (!status.enabled) {
    return "Sparse checkout is disabled.";
  }
  return status.patterns.length === 0
    ? "Sparse checkout is enabled with no explicit paths."
    : `${status.patterns.length} included path${status.patterns.length === 1 ? "" : "s"}`;
}

export function summarizeLfsStatus(status: LfsStatus, locks: LfsLockInfo[]) {
  return {
    available: status.available,
    lockCount: locks.length,
    pendingPushCount: status.pendingPushCount ?? null,
    pendingPullCount: status.pendingPullCount ?? null,
    hasRawOutput: status.output.trim().length > 0
  };
}
