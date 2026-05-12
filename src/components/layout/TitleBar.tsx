import { useEffect, useState } from "react";
import { useRepo } from "../../hooks/useRepo";

/**
 * Thin custom title bar replacing the OS chrome (Tauri's `decorations: false`).
 * Owns the drag region and window-control buttons.
 */
export function TitleBar() {
  const { activeRepo } = useRepo();
  const title = activeRepo ? `${activeRepo.name} — GitPulse` : "GitPulse";
  const [isMaximized, setIsMaximized] = useState(false);
  const [tauriReady, setTauriReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      return;
    }
    setTauriReady(true);
    let cancelled = false;
    let unlistenResize: (() => void) | undefined;

    void import("@tauri-apps/api/window")
      .then(async ({ getCurrentWindow }) => {
        const win = getCurrentWindow();
        const initial = await win.isMaximized().catch(() => false);
        if (!cancelled) setIsMaximized(initial);
        unlistenResize = await win.onResized(async () => {
          const next = await win.isMaximized().catch(() => false);
          if (!cancelled) setIsMaximized(next);
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      unlistenResize?.();
    };
  }, []);

  async function withWindow(fn: (win: Awaited<ReturnType<typeof getWindow>>) => Promise<void>) {
    if (!tauriReady) return;
    try {
      const win = await getWindow();
      await fn(win);
    } catch (error) {
      console.error("[titlebar]", error);
    }
  }

  return (
    <header className="title-bar" data-tauri-drag-region>
      <div className="title-bar__brand" data-tauri-drag-region>
        <span className="title-bar__title" data-tauri-drag-region>
          {title}
        </span>
      </div>
      <div className="title-bar__filler" data-tauri-drag-region />
      <div className="title-bar__controls">
        <button
          className="title-bar__control"
          onClick={() => void withWindow((win) => win.minimize())}
          title="Minimize"
          type="button"
          aria-label="Minimize"
        >
          <MinimizeIcon />
        </button>
        <button
          className="title-bar__control"
          onClick={() =>
            void withWindow((win) =>
              isMaximized ? win.unmaximize() : win.maximize()
            )
          }
          title={isMaximized ? "Restore" : "Maximize"}
          type="button"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>
        <button
          className="title-bar__control title-bar__control--close"
          onClick={() => void withWindow((win) => win.close())}
          title="Close"
          type="button"
          aria-label="Close"
        >
          <CloseIcon />
        </button>
      </div>
    </header>
  );
}

async function getWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

function MinimizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden focusable="false">
      <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden focusable="false">
      <rect
        x="0.5"
        y="0.5"
        width="9"
        height="9"
        fill="none"
        stroke="currentColor"
      />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden focusable="false">
      <rect
        x="2.5"
        y="0.5"
        width="7"
        height="7"
        fill="none"
        stroke="currentColor"
      />
      <rect
        x="0.5"
        y="2.5"
        width="7"
        height="7"
        fill="var(--vscode-titleBar-activeBackground)"
        stroke="currentColor"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden focusable="false">
      <path
        d="M1 1 L9 9 M9 1 L1 9"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="square"
        fill="none"
      />
    </svg>
  );
}
