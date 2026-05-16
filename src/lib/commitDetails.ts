import { gitShowCommit } from "./git";
import type { CommitDetail } from "../types/git";

const MAX_COMMIT_DETAILS = 2000;
const cache = new Map<string, Promise<CommitDetail>>();

export function getCommitDetail(repoPath: string, sha: string) {
  const key = `${repoPath}:${sha}`;
  const existing = cache.get(key);
  if (existing) {
    cache.delete(key);
    cache.set(key, existing);
    return existing;
  }

  const next = gitShowCommit(repoPath, sha).catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, next);
  if (cache.size > MAX_COMMIT_DETAILS) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return next;
}
