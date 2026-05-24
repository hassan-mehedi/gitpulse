import { useEffect, useState } from "react";
import { ActivityBar } from "./ActivityBar";
import { StatusBar } from "./StatusBar";
import { TitleBar } from "./TitleBar";
import { SourceControlPanel } from "../source-control/SourceControlPanel";
import { DiffViewer } from "../diff/DiffViewer";
import { ToastViewport } from "../shared/ToastViewport";
import type { ActivityView } from "../../types/git";
import { BranchManager } from "../branches/BranchManager";
import { SettingsPanel } from "../settings/SettingsPanel";
import { CommitIdentityOnboarding } from "../settings/CommitIdentityOnboarding";
import { CommitGraphList } from "../graph/CommitGraphList";
import { CommitGraphDetail } from "../graph/CommitGraphDetail";
import { BlameView } from "../blame/BlameView";
import { MiscPanel } from "../misc/MiscPanel";
import { TabStrip } from "../diff/TabStrip";
import { Sash } from "./Sash";
import { BranchPickerModal } from "../branches/BranchPickerModal";
import { ShortcutReferenceModal } from "../shared/ShortcutReferenceModal";
import { ConfirmModal } from "../shared/ConfirmModal";
import { useGit } from "../../hooks/useGit";
import { ignoreReportedError, reportBackgroundError } from "../../lib/errors";
import { isTauriRuntime } from "../../lib/runtime";
import { useRepo } from "../../hooks/useRepo";
import {
  gitFetchAll,
  gitPull,
  gitPush,
  gitStageFile,
  gitUnstageFile,
  gitUndoLastCommit
} from "../../lib/git";
import { useWorkspaceStore } from "../../stores/workspace";
import { useDiffStore } from "../../stores/diff";

export function AppShell() {
  const { activeRepo } = useRepo();
  const runGit = useGit();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const activeChange = useDiffStore((state) => state.activeChange);
  const staged = useDiffStore((state) => state.staged);
  const refreshActiveDiff = useDiffStore((state) => state.refreshActiveDiff);
  const [activeView, setActiveView] = useState<ActivityView>("source-control");
  const [isBranchPickerOpen, setIsBranchPickerOpen] = useState(false);
  const [branchPickerCreateMode, setBranchPickerCreateMode] = useState(false);
  const [branchPickerRepoId, setBranchPickerRepoId] = useState<string | null>(null);
  const [isShortcutReferenceOpen, setIsShortcutReferenceOpen] = useState(false);
  const [forcePushRepoPath, setForcePushRepoPath] = useState<string | null>(null);
  const [awaitingShortcutChord, setAwaitingShortcutChord] = useState<number | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 300;
    const stored = window.localStorage?.getItem("gitpulse:sidebarWidth");
    const parsed = stored ? Number(stored) : 300;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage?.getItem("gitpulse:sidebarCollapsed") === "true";
  });
  const fullPageView = activeView === "blame" || activeView === "misc" || activeView === "settings";
  const sidebarHidden = fullPageView || sidebarCollapsed;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("gitpulse:sidebarWidth", String(sidebarWidth));
    } catch {
      // localStorage may be unavailable (private mode); silent.
    }
  }, [sidebarWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "gitpulse:sidebarCollapsed",
        sidebarCollapsed ? "true" : "false"
      );
    } catch {
      // localStorage may be unavailable (private mode); silent.
    }
  }, [sidebarCollapsed]);

  // Click on an activity bar icon: switch view (and re-show the sidebar), or
  // toggle the sidebar if the same view is already active. Matches VS Code's
  // behaviour for clicking the active item.
  function handleActivitySelect(view: ActivityView) {
    if (view === activeView) {
      const targetIsFullPage = view === "blame" || view === "misc" || view === "settings";
      if (!targetIsFullPage) {
        setSidebarCollapsed((collapsed) => !collapsed);
      }
      return;
    }
    setActiveView(view);
    setSidebarCollapsed(false);
  }

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    void import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => {
        const next = activeRepo ? `${activeRepo.name} — GitPulse` : "GitPulse";
        return getCurrentWindow().setTitle(next);
      })
      .catch((error) => {
        reportBackgroundError(error, {
          operation: "Set window title",
          notify: false
        });
      });
  }, [activeRepo]);

  useEffect(() => {
    if (!awaitingShortcutChord) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAwaitingShortcutChord(null);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [awaitingShortcutChord]);

  useEffect(() => {
    // Resolve "current" active repo / change imperatively from the stores so this
    // effect doesn't need to re-attach the keydown listener on every status refresh.
    function getActiveRepo() {
      const state = useWorkspaceStore.getState();
      return state.repositories.find((repo) => repo.id === state.activeRepoId) ?? null;
    }

    async function runRepoOperation(operation: "fetch" | "pull" | "push" | "force-push" | "undo") {
      const repo = getActiveRepo();
      if (!repo) {
        return;
      }

      await runGit(async () => {
        if (operation === "fetch") {
          await gitFetchAll(repo.path);
        } else if (operation === "pull") {
          await gitPull(repo.path);
        } else if (operation === "push") {
          await gitPush(repo.path);
        } else if (operation === "force-push") {
          await gitPush(repo.path, undefined, undefined, true);
        } else {
          await gitUndoLastCommit(repo.path);
        }

        await refreshRepo(repo.path);
      });
    }

    async function runStageShortcut(nextStaged: boolean) {
      const repo = getActiveRepo();
      const change = useDiffStore.getState().activeChange;
      if (!repo || !change) {
        return;
      }

      await runGit(async () => {
        if (nextStaged) {
          await gitStageFile(repo.path, change.path);
        } else {
          await gitUnstageFile(repo.path, change.path);
        }
        await refreshRepo(repo.path);
        await refreshActiveDiff();
      });
    }

    function handleKeyDown(event: KeyboardEvent) {
      const isPrimaryModifier = event.ctrlKey || event.metaKey;
      const target = event.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.closest("input, textarea, select, [contenteditable='true']") !== null ||
          target.isContentEditable);

      if (awaitingShortcutChord && isPrimaryModifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setAwaitingShortcutChord(null);
        setIsShortcutReferenceOpen(true);
        return;
      }

      if (isPrimaryModifier && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAwaitingShortcutChord(Date.now());
        return;
      }

      if (isTyping) {
        return;
      }

      if (!(isPrimaryModifier && event.shiftKey)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "g") {
        event.preventDefault();
        if (activeView === "source-control" && !sidebarCollapsed) {
          setSidebarCollapsed(true);
        } else {
          setActiveView("source-control");
          setSidebarCollapsed(false);
        }
      } else if (key === "b") {
        event.preventDefault();
        setBranchPickerCreateMode(false);
        setIsBranchPickerOpen(true);
      } else if (key === "n") {
        event.preventDefault();
        setBranchPickerCreateMode(true);
        setIsBranchPickerOpen(true);
      } else if (key === "f") {
        event.preventDefault();
        void runRepoOperation("fetch");
      } else if (key === "l") {
        event.preventDefault();
        void runRepoOperation("pull");
      } else if (key === "p") {
        event.preventDefault();
        if (event.altKey) {
          const repo = getActiveRepo();
          if (repo) setForcePushRepoPath(repo.path);
        } else {
          void runRepoOperation("push");
        }
      } else if (key === "z") {
        event.preventDefault();
        void runRepoOperation("undo");
      } else if (event.code === "Period") {
        event.preventDefault();
        void runStageShortcut(true);
      } else if (event.code === "Comma") {
        event.preventDefault();
        void runStageShortcut(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeView, awaitingShortcutChord, refreshActiveDiff, refreshRepo, runGit, sidebarCollapsed]);

  function openBranchPickerForRepo(repoId?: string | null, createMode = false) {
    const resolvedRepoId = repoId ?? useWorkspaceStore.getState().activeRepoId ?? null;
    setBranchPickerRepoId(resolvedRepoId);
    if (repoId) {
      useWorkspaceStore.getState().setActiveRepo(repoId);
    }
    setBranchPickerCreateMode(createMode);
    setIsBranchPickerOpen(true);
  }

  return (
    <div className="app-shell">
      <TitleBar />
      <div
        className={`main-layout${
          sidebarHidden ? " main-layout--no-sidebar" : ""
        }`}
        style={
          sidebarHidden
            ? undefined
            : ({
                "--sidebar-width": `${sidebarWidth}px`
              } as React.CSSProperties)
        }
      >
        <ActivityBar activeView={activeView} onSelect={handleActivitySelect} />
        {sidebarHidden ? null : (
          <>
            <section className="left-panel">
              {activeView === "branches" ? (
                <BranchManager onOpenBranchPicker={(repo) => openBranchPickerForRepo(repo.id)} />
              ) : activeView === "graph" ? (
                <CommitGraphList onNavigateToView={setActiveView} />
              ) : (
                <SourceControlPanel
                  activeView={activeView}
                  onOpenBranchPicker={(repo) => openBranchPickerForRepo(repo.id)}
                />
              )}
            </section>
            <Sash value={sidebarWidth} onChange={setSidebarWidth} min={170} max={720} />
          </>
        )}
        <section className="content-panel">
          {activeView === "graph" ? (
            <CommitGraphDetail />
          ) : activeView === "settings" ? (
            <SettingsPanel />
          ) : activeView === "misc" ? (
            <MiscPanel />
          ) : activeView === "blame" ? (
            <BlameView />
          ) : (
            <>
              <TabStrip scope="source-control" />
              <DiffViewer activeView={activeView} />
            </>
          )}
        </section>
      </div>
      <StatusBar
        onOpenBranchPicker={() => {
          openBranchPickerForRepo(null, false);
        }}
      />
      <CommitIdentityOnboarding />
      <ToastViewport />
      <BranchPickerModal
        initialCreateMode={branchPickerCreateMode}
        isOpen={isBranchPickerOpen}
        targetRepoId={branchPickerRepoId}
        onClose={() => {
          setIsBranchPickerOpen(false);
          setBranchPickerRepoId(null);
        }}
      />
      <ShortcutReferenceModal
        isOpen={isShortcutReferenceOpen}
        onClose={() => setIsShortcutReferenceOpen(false)}
      />
      <ConfirmModal
        isOpen={forcePushRepoPath !== null}
        title="Force Push With Lease"
        body="Force push the active repository using --force-with-lease?"
        confirmLabel="Force Push"
        danger
        onConfirm={() => {
          if (!forcePushRepoPath) return;
          void runGit(async () => {
            await gitPush(forcePushRepoPath, undefined, undefined, true);
            await refreshRepo(forcePushRepoPath);
          }).catch(ignoreReportedError);
        }}
        onClose={() => setForcePushRepoPath(null)}
      />
    </div>
  );
}
