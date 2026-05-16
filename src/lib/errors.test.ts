import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorMessage, reportBackgroundError } from "./errors";
import { useNotificationStore } from "../stores/notifications";
import { useOutputStore } from "../stores/output";

describe("error reporting", () => {
  beforeEach(() => {
    useNotificationStore.setState({ items: [] });
    useOutputStore.setState({ items: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers structured git error details", () => {
    expect(errorMessage({ message: "message", stderr: "stderr", kind: "kind" })).toBe("message");
    expect(errorMessage({ stderr: "stderr", kind: "kind" })).toBe("stderr");
    expect(errorMessage({ kind: "kind" })).toBe("kind");
  });

  it("records output without notifying when requested", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    reportBackgroundError(new Error("boom"), {
      operation: "Background sync",
      notify: false
    });

    expect(useOutputStore.getState().items[0]).toMatchObject({
      operation: "Background sync",
      message: "boom",
      status: "failed"
    });
    expect(useNotificationStore.getState().items).toHaveLength(0);
  });
});
