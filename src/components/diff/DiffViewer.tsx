import { useEffect, useMemo, useState } from "react";
import { Columns2, Rows3, WandSparkles } from "lucide-react";
import { gitDiscardLines, gitStageLines, gitUnstageLines } from "../../lib/git";
import { buildPatch, buildPatchFromSelectedLines } from "../../lib/patch";
import { useGit } from "../../hooks/useGit";
import { useWorkspaceStore } from "../../stores/workspace";
import { useDiffStore } from "../../stores/diff";
import { DiffGutter } from "./DiffGutter";
import { DiffHunk } from "./DiffHunk";
import { DiffNavigation } from "./DiffNavigation";
import type { ActivityView } from "../../types/git";

interface DiffViewerProps {
  activeView: ActivityView;
}

export function DiffViewer({ activeView }: DiffViewerProps) {
  const {
    activeChange,
    activeDiff,
    mode,
    setMode,
    activeRepo,
    staged,
    activeHunkIndex,
    setActiveHunkIndex,
    refreshActiveDiff
  } = useDiffStore();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const runGit = useGit();
  const [selectedLinesByHunk, setSelectedLinesByHunk] = useState<Record<number, number[]>>({});

  if (activeView !== "source-control") {
    return (
      <div className="empty-state">
        <div className="empty-state__card">
          <div className="empty-state__title">Ready for {activeView}</div>
          <div className="empty-state__body">
            The main content area is live. Additional panels can take over this region without
            touching the shell structure.
          </div>
        </div>
      </div>
    );
  }

  if (!activeDiff || !activeChange || !activeRepo) {
    return (
      <div className="empty-state">
        <div className="empty-state__card">
          <div className="empty-state__title">Select a file to inspect changes</div>
          <div className="empty-state__body">
            The first implementation slice includes status, staging, commit actions, and a minimal
            diff surface driven by backend git output.
          </div>
        </div>
      </div>
    );
  }

  const diff = activeDiff;
  const change = activeChange;
  const repo = activeRepo;
  const activeHunk = diff.hunks[activeHunkIndex] ?? null;
  const selectedActiveLineIndices = selectedLinesByHunk[activeHunkIndex] ?? [];
  const canStage = Boolean(activeHunk);
  const canDiscard = Boolean(activeHunk && !staged);
  const canStageSelection = selectedActiveLineIndices.length > 0;

  useEffect(() => {
    setSelectedLinesByHunk({});
  }, [diff.file, staged, repo.path]);

  const summary = useMemo(() => {
    return diff.hunks.map((hunk, index) => ({
      index,
      additions: hunk.lines.filter((line) => line.lineType === "add").length,
      deletions: hunk.lines.filter((line) => line.lineType === "remove").length
    }));
  }, [diff.hunks]);

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

  return (
    <div className="diff-viewer">
      <div className="diff-viewer__header">
        <div>
          <div>{change.path}</div>
          <div className="diff-viewer__meta">
            {repo.name} • {staged ? "staged" : "working tree"}
          </div>
        </div>
        <div className="diff-viewer__mode-switch">
          <DiffNavigation
            activeIndex={activeHunkIndex}
            total={diff.hunks.length}
            onPrevious={goToPreviousHunk}
            onNext={goToNextHunk}
          />
          {canStageSelection ? (
            <div className="badge">
              <WandSparkles size={14} />
              {selectedActiveLineIndices.length} selected
            </div>
          ) : null}
          <button
            className="panel-button"
            onClick={() => setMode("split")}
            type="button"
          >
            <Columns2 size={15} /> Split
          </button>
          <button
            className="panel-button"
            onClick={() => setMode("inline")}
            type="button"
          >
            <Rows3 size={15} /> Inline
          </button>
        </div>
      </div>

      <div className="diff-viewer__body">
        <aside className="diff-viewer__sidebar">
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
        </aside>

        <div className="diff-viewer__content">
          {diff.hunks.map((hunk, index) => (
            <DiffHunk
              key={`${hunk.header}-${index}`}
              hunk={hunk}
              hunkIndex={index}
              isActive={index === activeHunkIndex}
              mode={mode}
              onFocus={() => setActiveHunkIndex(index)}
              onToggleLine={toggleLineSelection}
              selectedLineIndices={selectedLinesByHunk[index] ?? []}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
