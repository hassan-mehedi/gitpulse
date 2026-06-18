import { beforeEach, describe, expect, it, vi } from "vitest";
import { gitDiffFile } from "../lib/git";
import type { FileChange, FileDiff, Repository } from "../types/git";
import { useDiffStore } from "./diff";

vi.mock("../lib/git", () => ({
  gitDiffFile: vi.fn()
}));

const mockedGitDiffFile = vi.mocked(gitDiffFile);

const repo: Repository = {
  id: "repo-1",
  name: "Repo",
  path: "/repos/app",
  branch: "main",
  headSha: "abc123",
  ahead: 0,
  behind: 0,
  stashCount: 0,
  changes: [],
  staged: [],
  hasConflicts: false
};

function change(path: string, status: string): FileChange {
  return { path, status, staged: false };
}

function diff(file: string, status = "M"): FileDiff {
  return { file, status, hunks: [], isBinary: false };
}

describe("diff store", () => {
  beforeEach(() => {
    useDiffStore.getState().clear();
    mockedGitDiffFile.mockReset();
  });

  it("reopens conflict tabs with a merge placeholder instead of loading a normal diff", async () => {
    const conflict = change("src/conflicted.ts", "U");
    const modified = change("src/changed.ts", "M");

    useDiffStore.getState().setActiveDiff(repo, conflict, false, diff(conflict.path, "U"));
    useDiffStore.getState().pinActiveTab();
    useDiffStore.getState().setActiveDiff(repo, modified, false, diff(modified.path));

    await useDiffStore.getState().selectTab("u:repo-1:src/conflicted.ts");

    expect(mockedGitDiffFile).not.toHaveBeenCalled();
    expect(useDiffStore.getState().activeDiff).toMatchObject({
      file: "src/conflicted.ts",
      status: "U",
      hunks: []
    });
  });
});
