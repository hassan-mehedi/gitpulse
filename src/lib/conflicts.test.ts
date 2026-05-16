import { describe, expect, it } from "vitest";
import { buildResolvedConflictContent, parseConflictSegments } from "./conflicts";

const rawConflict = [
  "before",
  "<<<<<<< HEAD",
  "current",
  "=======",
  "incoming",
  ">>>>>>> feature",
  "after"
].join("\n");

describe("conflict resolution", () => {
  it("preserves requested ordering for accept both", () => {
    const segments = parseConflictSegments(rawConflict);

    expect(buildResolvedConflictContent(segments, { 0: "both-ours-first" })).toBe(
      ["before", "current", "incoming", "after"].join("\n")
    );
    expect(buildResolvedConflictContent(segments, { 0: "both-theirs-first" })).toBe(
      ["before", "incoming", "current", "after"].join("\n")
    );
  });
});
