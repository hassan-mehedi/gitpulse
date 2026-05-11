import { useEffect, useMemo, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { gitDiscardLines, gitStageLines, gitUnstageLines } from "../../lib/git";
import { buildPatch, buildPatchFromSelectedLines } from "../../lib/patch";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import { useDiffStore } from "../../stores/diff";
import { useSettingsStore } from "../../stores/settings";
import { FileHistoryPanel } from "../source-control/FileHistoryPanel";
import { MergeEditor } from "../merge/MergeEditor";
import { DiffGutter } from "./DiffGutter";
import { DiffHunk } from "./DiffHunk";
import { DiffNavigation } from "./DiffNavigation";
import type { ActivityView } from "../../types/git";

interface DiffViewerProps {
  activeView: ActivityView;
}

export function DiffViewer({ activeView }: DiffViewerProps) {
  // Per-field selectors so Zustand re-renders this component on any of these changing.
  // The previous `useDiffStore()` (no selector) was deprecated in Zustand v5 and silently
  // stopped triggering re-renders for subsequent changes in some cases.
  const activeChange = useDiffStore((state) => state.activeChange);
  const activeDiff = useDiffStore((state) => state.activeDiff);
  const activeRepo = useDiffStore((state) => state.activeRepo);
  const staged = useDiffStore((state) => state.staged);
  const mode = useDiffStore((state) => state.mode);
  const activeHunkIndex = useDiffStore((state) => state.activeHunkIndex);
  const setMode = useDiffStore((state) => state.setMode);
  const setActiveHunkIndex = useDiffStore((state) => state.setActiveHunkIndex);
  const refreshActiveDiff = useDiffStore((state) => state.refreshActiveDiff);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const theme = useSettingsStore((state) => state.theme);
  const runGit = useGit();
  const [selectedLinesByHunk, setSelectedLinesByHunk] = useState<Record<number, number[]>>({});
  const [surface, setSurface] = useState<"diff" | "history">("diff");
  const [showOutline, setShowOutline] = useState(false);
  const diffState = activeDiff;
  const changeState = activeChange;
  const repoState = activeRepo;
  const activeHunk = diffState?.hunks[activeHunkIndex] ?? null;
  const selectedActiveLineIndices = selectedLinesByHunk[activeHunkIndex] ?? [];
  const canStage = Boolean(activeHunk);
  const canDiscard = Boolean(activeHunk && !staged);
  const canStageSelection = selectedActiveLineIndices.length > 0;

  useEffect(() => {
    if (!diffState || !repoState) {
      return;
    }

    setSelectedLinesByHunk({});
  }, [diffState, staged, repoState]);

  useEffect(() => {
    if (!changeState || !repoState) {
      return;
    }

    setSurface("diff");
  }, [changeState, repoState]);

  const summary = useMemo(() => {
    if (!diffState) {
      return [];
    }

    return diffState.hunks.map((hunk, index) => ({
      index,
      additions: hunk.lines.filter((line) => line.lineType === "add").length,
      deletions: hunk.lines.filter((line) => line.lineType === "remove").length
    }));
  }, [diffState]);

  // Alt+Up / Alt+Down hunk navigation. Declared ABOVE the conditional early returns
  // so the hook order is stable across renders (Rules of Hooks).
  const hunkCount = diffState?.hunks.length ?? 0;
  useEffect(() => {
    if (activeView !== "source-control" || hunkCount === 0) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.altKey && !event.ctrlKey && !event.metaKey)) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest("input, textarea, select, [contenteditable='true']") !== null ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveHunkIndex((activeHunkIndex - 1 + hunkCount) % hunkCount);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveHunkIndex((activeHunkIndex + 1) % hunkCount);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeHunkIndex, activeView, hunkCount, setActiveHunkIndex]);

  if (activeView !== "source-control") {
    return <WelcomeHints />;
  }

  if (!activeDiff || !activeChange || !activeRepo) {
    return <WelcomeHints />;
  }

  const diff = activeDiff;
  const change = activeChange;
  const repo = activeRepo;

  async function applyHunkAction(action: "stage" | "unstage" | "discard") {
    if (!activeHunk) {
      return;
    }

    const patch = buildPatch(change.path, [activeHunk], diff.oldFile);
    await runGit(async () => {
      if (action === "stage") {
        await gitStageLines(repo.path, change.path, patch);
      } else if (action === "unstage") {
        await gitUnstageLines(repo.path, change.path, patch);
      } else {
        await gitDiscardLines(repo.path, change.path, patch);
      }

      await refreshRepo(repo.path);
      await refreshActiveDiff();
      setSelectedLinesByHunk({});
    });
  }

  async function applySelectionAction(action: "stage" | "unstage" | "discard") {
    if (!activeHunk || selectedActiveLineIndices.length === 0) {
      return;
    }

    const patch = buildPatchFromSelectedLines(
      change.path,
      activeHunk,
      selectedActiveLineIndices,
      diff.oldFile
    );
    await runGit(async () => {
      if (action === "stage") {
        await gitStageLines(repo.path, change.path, patch);
      } else if (action === "unstage") {
        await gitUnstageLines(repo.path, change.path, patch);
      } else {
        await gitDiscardLines(repo.path, change.path, patch);
      }

      await refreshRepo(repo.path);
      await refreshActiveDiff();
      setSelectedLinesByHunk((state) => ({
        ...state,
        [activeHunkIndex]: []
      }));
    });
  }

  function toggleLineSelection(hunkIndex: number, lineIndex: number) {
    const line = diff.hunks[hunkIndex]?.lines[lineIndex];
    if (!line || line.lineType === "context") {
      return;
    }

    setSelectedLinesByHunk((state) => {
      const current = new Set(state[hunkIndex] ?? []);
      if (current.has(lineIndex)) {
        current.delete(lineIndex);
      } else {
        current.add(lineIndex);
      }

      return {
        ...state,
        [hunkIndex]: Array.from(current).sort((left, right) => left - right)
      };
    });
  }

  function goToPreviousHunk() {
    if (diff.hunks.length === 0) {
      return;
    }
    setActiveHunkIndex((activeHunkIndex - 1 + diff.hunks.length) % diff.hunks.length);
  }

  function goToNextHunk() {
    if (diff.hunks.length === 0) {
      return;
    }
    setActiveHunkIndex((activeHunkIndex + 1) % diff.hunks.length);
  }

  const segments = change.path.split("/");
  const fileName = segments.pop() ?? change.path;
  const fileDir = segments.join("/");

  return (
    <div className="diff-viewer">
      <div className="diff-viewer__header">
        <div className="diff-viewer__title">
          <span className="diff-viewer__filename">{fileName}</span>
          {fileDir ? <span className="diff-viewer__dir">{fileDir}</span> : null}
          <span className="diff-viewer__meta">
            {staged ? "staged" : "working tree"}
          </span>
          {canStageSelection ? (
            <span className="diff-viewer__selection-count">
              {selectedActiveLineIndices.length} selected
            </span>
          ) : null}
        </div>
        <div className="diff-viewer__toolbar">
          <button
            className={`diff-viewer__tab${surface === "diff" ? " is-active" : ""}`}
            onClick={() => setSurface("diff")}
            title="Diff"
            type="button"
          >
            <Codicon name="diff-single" size={14} />
          </button>
          <button
            className={`diff-viewer__tab${surface === "history" ? " is-active" : ""}`}
            onClick={() => setSurface("history")}
            title="History"
            type="button"
          >
            <Codicon name="history" size={14} />
          </button>
          {surface === "diff" ? (
            <>
              <span className="diff-viewer__divider" />
              <button
                className="view-action"
                onClick={goToPreviousHunk}
                title="Previous Change (Alt+Up)"
                aria-label="Previous Change"
                disabled={diff.hunks.length === 0}
                type="button"
              >
                <Codicon name="arrow-up" size={16} />
              </button>
              <button
                className="view-action"
                onClick={goToNextHunk}
                title="Next Change (Alt+Down)"
                aria-label="Next Change"
                disabled={diff.hunks.length === 0}
                type="button"
              >
                <Codicon name="arrow-down" size={16} />
              </button>
              <span className="diff-viewer__hunk-counter">
                {diff.hunks.length === 0
                  ? "0 hunks"
                  : `${activeHunkIndex + 1} / ${diff.hunks.length}`}
              </span>
              <span className="diff-viewer__divider" />
              <button
                className={`view-action${mode === "split" ? " is-active" : ""}`}
                onClick={() => setMode("split")}
                title="Side-by-side"
                aria-label="Side-by-side"
                type="button"
              >
                <Codicon name="split-horizontal" size={16} />
              </button>
              <button
                className={`view-action${mode === "inline" ? " is-active" : ""}`}
                onClick={() => setMode("inline")}
                title="Inline"
                aria-label="Inline"
                type="button"
              >
                <Codicon name="list-flat" size={16} />
              </button>
              <span className="diff-viewer__divider" />
              <button
                className={`view-action${showOutline ? " is-active" : ""}`}
                onClick={() => setShowOutline((value) => !value)}
                title={showOutline ? "Hide Hunk Outline" : "Show Hunk Outline"}
                aria-label="Toggle Hunk Outline"
                type="button"
              >
                <Codicon name="list-tree" size={16} />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {surface === "history" ? (
        <FileHistoryPanel filePath={change.path} repo={repo} />
      ) : change.status === "U" ? (
        <MergeEditor filePath={change.path} repoPath={repo.path} />
      ) : (
        <div
          className={`diff-viewer__body${showOutline ? "" : " diff-viewer__body--no-outline"}`}
        >
          {showOutline ? <aside className="diff-viewer__sidebar">
            <DiffGutter
              canDiscard={canDiscard}
              canStage={canStage}
              canStageSelection={canStageSelection}
              onDiscard={() => void applyHunkAction("discard")}
              onSelectionDiscard={() => void applySelectionAction("discard")}
              onSelectionToggle={() => void applySelectionAction(staged ? "unstage" : "stage")}
              onStageToggle={() => void applyHunkAction(staged ? "unstage" : "stage")}
              staged={staged}
            />
            <div className="diff-outline">
              {summary.map((item) => (
                <button
                  key={item.index}
                  className={`diff-outline__item ${item.index === activeHunkIndex ? "is-active" : ""}`}
                  onClick={() => setActiveHunkIndex(item.index)}
                  type="button"
                >
                  <span>Hunk {item.index + 1}</span>
                  <span className="diff-outline__meta">
                    +{item.additions} -{item.deletions}
                  </span>
                </button>
              ))}
            </div>
          </aside> : null}

          <div className="diff-viewer__content">
            {diff.hunks.length === 0 ? (
              <div className="diff-viewer__placeholder">
                {diff.isBinary
                  ? "Binary file — no textual diff."
                  : "No textual changes to display."}
              </div>
            ) : (
              diff.hunks.map((hunk, index) => (
                <DiffHunk
                  filePath={change.path}
                  key={`${hunk.header}-${index}`}
                  hunk={hunk}
                  hunkIndex={index}
                  isActive={index === activeHunkIndex}
                  mode={mode}
                  theme={theme}
                  onFocus={() => setActiveHunkIndex(index)}
                  onToggleLine={toggleLineSelection}
                  selectedLineIndices={selectedLinesByHunk[index] ?? []}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * VS Code-style welcome surface: faint keybinding hints centered in the editor
 * area, no card framing.
 */
function WelcomeHints() {
  return (
    <div className="welcome-hints">
      <div className="welcome-hints__row">
        <span>Show Source Control</span>
        <kbd>Ctrl</kbd>
        <span className="welcome-hints__plus">+</span>
        <kbd>Shift</kbd>
        <span className="welcome-hints__plus">+</span>
        <kbd>G</kbd>
      </div>
      <div className="welcome-hints__row">
        <span>Switch Branch</span>
        <kbd>Ctrl</kbd>
        <span className="welcome-hints__plus">+</span>
        <kbd>Shift</kbd>
        <span className="welcome-hints__plus">+</span>
        <kbd>B</kbd>
      </div>
      <div className="welcome-hints__row">
        <span>Show All Shortcuts</span>
        <kbd>Ctrl</kbd>
        <span className="welcome-hints__plus">+</span>
        <kbd>K</kbd>
        <span className="welcome-hints__plus">,</span>
        <kbd>Ctrl</kbd>
        <span className="welcome-hints__plus">+</span>
        <kbd>S</kbd>
      </div>
    </div>
  );
}
