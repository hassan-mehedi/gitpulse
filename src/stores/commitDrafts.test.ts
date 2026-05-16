import { beforeEach, describe, expect, it } from "vitest";
import { useCommitDraftStore } from "./commitDrafts";

describe("commit draft store", () => {
  beforeEach(() => {
    useCommitDraftStore.setState({ drafts: {} });
  });

  it("keeps drafts isolated per repository", () => {
    const store = useCommitDraftStore.getState();

    store.setDraft("/repo/a", "first");
    store.setDraft("/repo/b", "second");

    expect(useCommitDraftStore.getState().getDraft("/repo/a")).toBe("first");
    expect(useCommitDraftStore.getState().getDraft("/repo/b")).toBe("second");
  });

  it("clears only the requested repository draft", () => {
    const store = useCommitDraftStore.getState();
    store.setDraft("/repo/a", "first");
    store.setDraft("/repo/b", "second");

    store.clearDraft("/repo/a");

    expect(useCommitDraftStore.getState().getDraft("/repo/a")).toBe("");
    expect(useCommitDraftStore.getState().getDraft("/repo/b")).toBe("second");
  });
});
