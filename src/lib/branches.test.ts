import { describe, expect, it } from "vitest";
import { branchNeedsPublish, selectPublishRemote, upstreamBranchName } from "./branches";
import type { RemoteInfo } from "../types/git";

function remote(name: string, fetchUrl = "", pushUrl = fetchUrl): RemoteInfo {
  return { name, fetchUrl, pushUrl };
}

describe("branch helpers", () => {
  it("prefers origin when selecting a publish remote", () => {
    expect(selectPublishRemote([remote("upstream"), remote("origin")])?.name).toBe("origin");
  });

  it("falls back to the first configured remote with a URL", () => {
    expect(
      selectPublishRemote([
        remote("empty", "", ""),
        remote("fork", "git@example.com:me/repo.git")
      ])?.name
    ).toBe("fork");
  });

  it("returns null when no remote can publish", () => {
    expect(selectPublishRemote([remote("empty", "", "")])).toBeNull();
  });

  it("extracts the branch name from an upstream ref", () => {
    expect(upstreamBranchName("origin/feature/bulk-staff-invite")).toBe(
      "feature/bulk-staff-invite"
    );
  });

  it("treats a differently named upstream as needing publish", () => {
    expect(branchNeedsPublish("feature/bulk-staff-invite", "origin/develop")).toBe(true);
    expect(branchNeedsPublish("feature/bulk-staff-invite", "origin/feature/bulk-staff-invite")).toBe(
      false
    );
  });
});
