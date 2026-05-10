import { useEffect, useState } from "react";
import { ActivityBar } from "./ActivityBar";
import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";
import { SourceControlPanel } from "../source-control/SourceControlPanel";
import { DiffViewer } from "../diff/DiffViewer";
import { ToastViewport } from "../shared/ToastViewport";
import type { ActivityView } from "../../types/git";
import { BranchManager } from "../branches/BranchManager";
import { SettingsPanel } from "../settings/SettingsPanel";
import { CommitGraph } from "../graph/CommitGraph";
import { BlameView } from "../blame/BlameView";
import { BranchPickerModal } from "../branches/BranchPickerModal";
import { ShortcutReferenceModal } from "../shared/ShortcutReferenceModal";
import { useGit } from "../../hooks/useGit";
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
  const [isShortcutReferenceOpen, setIsShortcutReferenceOpen] = useState(false);
  const [awaitingShortcutChord, setAwaitingShortcutChord] = useState<number | null>(null);

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
    async function runRepoOperation(operation: "fetch" | "pull" | "push" | "undo") {
      if (!activeRepo) {
        return;
      }

      await runGit(async () => {
        if (operation === "fetch") {
          await gitFetchAll(activeRepo.path);
        } else if (operation === "pull") {
          await gitPull(activeRepo.path);
        } else if (operation === "push") {
          await gitPush(activeRepo.path);
        } else {
          await gitUndoLastCommit(activeRepo.path);
        }

        await refreshRepo(activeRepo.path);
      });
    }

    async function runStageShortcut(nextStaged: boolean) {
      if (!activeRepo || !activeChange) {
        return;
      }

      await runGit(async () => {
        if (nextStaged) {
          await gitStageFile(activeRepo.path, activeChange.path);
        } else {
          await gitUnstageFile(activeRepo.path, activeChange.path);
        }
        await refreshRepo(activeRepo.path);
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
        setActiveView("source-control");
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
        void runRepoOperation("push");
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
  }, [
    activeChange,
    activeRepo,
    awaitingShortcutChord,
    refreshActiveDiff,
    refreshRepo,
    runGit,
    staged
  ]);

  return (
    <div className="app-shell">
      <Toolbar />
      <div className="main-layout">
        <ActivityBar activeView={activeView} onNavigate={setActiveView} />
        <section className="left-panel">
          {activeView === "branches" ? (
            <BranchManager />
          ) : activeView === "settings" ? (
            <SettingsPanel />
          ) : (
            <SourceControlPanel activeView={activeView} />
          )}
        </section>
        <section className="content-panel">
          {activeView === "graph" ? (
            <CommitGraph />
          ) : activeView === "blame" ? (
            <BlameView />
          ) : (
            <DiffViewer activeView={activeView} />
          )}
        </section>
      </div>
      <StatusBar
        onOpenBranchPicker={() => {
          setBranchPickerCreateMode(false);
          setIsBranchPickerOpen(true);
        }}
      />
      <ToastViewport />
      <BranchPickerModal
        initialCreateMode={branchPickerCreateMode}
        isOpen={isBranchPickerOpen}
        onClose={() => setIsBranchPickerOpen(false)}
      />
      <ShortcutReferenceModal
        isOpen={isShortcutReferenceOpen}
        onClose={() => setIsShortcutReferenceOpen(false)}
      />
    </div>
  );
}
