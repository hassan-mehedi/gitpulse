import { beforeEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "./settings";

describe("settings store recents", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      recentRepositoryPaths: [],
      recentWorkspacePaths: []
    });
  });

  it("remembers recent workspaces separately from repositories", () => {
    const store = useSettingsStore.getState();

    store.rememberRepository("/repos/app");
    store.rememberWorkspace("/workspaces/product.code-workspace");

    expect(useSettingsStore.getState().recentRepositoryPaths).toEqual(["/repos/app"]);
    expect(useSettingsStore.getState().recentWorkspacePaths).toEqual([
      "/workspaces/product.code-workspace"
    ]);
  });

  it("deduplicates and moves a reopened workspace to the top", () => {
    const store = useSettingsStore.getState();

    store.rememberWorkspace("/workspaces/first.code-workspace");
    store.rememberWorkspace("/workspaces/second.code-workspace");
    store.rememberWorkspace("/workspaces/first.code-workspace");

    expect(useSettingsStore.getState().recentWorkspacePaths).toEqual([
      "/workspaces/first.code-workspace",
      "/workspaces/second.code-workspace"
    ]);
  });

  it("removes individual recent entries", () => {
    const store = useSettingsStore.getState();

    store.rememberRepository("/repos/one");
    store.rememberRepository("/repos/two");
    store.rememberWorkspace("/workspaces/one.code-workspace");
    store.rememberWorkspace("/workspaces/two.code-workspace");

    store.forgetRepository("/repos/one");
    store.forgetWorkspace("/workspaces/two.code-workspace");

    expect(useSettingsStore.getState().recentRepositoryPaths).toEqual(["/repos/two"]);
    expect(useSettingsStore.getState().recentWorkspacePaths).toEqual([
      "/workspaces/one.code-workspace"
    ]);
  });
});
