import { describe, expect, it } from "vitest";
import {
  submoduleStatusMeta,
  summarizeLfsStatus,
  summarizeSparseCheckout
} from "./miscViews";

describe("misc view helpers", () => {
  it("maps submodule states to readable labels", () => {
    expect(
      submoduleStatusMeta({ path: "dep", sha: "abc", status: "-", description: "" }).label
    ).toBe("Not initialized");
    expect(
      submoduleStatusMeta({ path: "dep", sha: "abc", status: "U", description: "" }).tone
    ).toBe("danger");
  });

  it("summarizes sparse checkout and lfs status", () => {
    expect(summarizeSparseCheckout({ enabled: false, patterns: [] })).toContain("disabled");
    expect(summarizeSparseCheckout({ enabled: true, patterns: ["src", "docs"] })).toBe(
      "2 included paths"
    );
    expect(
      summarizeLfsStatus(
        {
          available: true,
          pendingPushCount: 3,
          pendingPullCount: 1,
          output: "raw"
        },
        [{ path: "asset.bin", owner: "me", id: "1" }]
      )
    ).toMatchObject({
      available: true,
      lockCount: 1,
      pendingPushCount: 3,
      pendingPullCount: 1
    });
  });
});
