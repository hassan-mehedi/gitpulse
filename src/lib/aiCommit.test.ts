import { describe, expect, it } from "vitest";
import { prepareAiDiffContext } from "./aiCommit";

describe("prepareAiDiffContext", () => {
  it("returns the original diff when it fits", () => {
    const diff = "diff --git a/a.ts b/a.ts\n@@\n+const value = 1;";

    expect(prepareAiDiffContext(diff, diff.length + 10)).toBe(diff);
  });

  it("keeps a summary and representative hunks when the diff is large", () => {
    const diff = [
      "diff --git a/a.ts b/a.ts",
      "@@",
      "+const first = 1;",
      "+const second = 2;",
      "diff --git a/b.ts b/b.ts",
      "@@",
      "+const third = 3;",
      "+const fourth = 4;"
    ].join("\n");

    const result = prepareAiDiffContext(diff, 120);

    expect(result).toContain("FILES CHANGED:");
    expect(result).toContain("REPRESENTATIVE HUNKS:");
    expect(result).toContain("a.ts");
  });
});
