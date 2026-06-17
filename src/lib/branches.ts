import type { BranchInfo, RemoteInfo } from "../types/git";

export function inferLocalBranchName(branchName: string) {
  const segments = branchName.split("/");
  return segments.length > 1 ? segments.slice(1).join("/") : branchName;
}

export function findTrackedLocalBranch(branches: BranchInfo[], branch: BranchInfo) {
  if (!branch.isRemote) {
    return branch;
  }

  const localName = inferLocalBranchName(branch.name);
  return branches.find((candidate) => !candidate.isRemote && candidate.name === localName) ?? null;
}

export function formatBranchMeta(branch: BranchInfo) {
  const upstream = branch.upstream ?? "No upstream";
  const activity = branch.lastCommitDate || (!branch.lastCommitSha ? "No commits yet" : "Unknown date");
  return `${upstream} • ${activity}`;
}

export function selectPublishRemote(remotes: RemoteInfo[]) {
  return (
    remotes.find((remote) => remote.name === "origin") ??
    remotes.find((remote) => remote.pushUrl || remote.fetchUrl) ??
    null
  );
}
