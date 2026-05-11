import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Codicon } from "../shared/Codicon";
import { FileIcon } from "../shared/FileIcon";
import { useRepo } from "../../hooks/useRepo";
import { useGit } from "../../hooks/useGit";
import { useSettingsStore } from "../../stores/settings";
import { useGraphStore } from "../../stores/graph";
import { useWorkspaceStore } from "../../stores/workspace";
import {
  gitCherryPick,
  gitCommitDiff,
  gitCreateBranch,
  gitCreateTag,
  gitSwitchBranch
} from "../../lib/git";
import { GraphToolbar } from "./GraphToolbar";
import { DiffHunk } from "../diff/DiffHunk";
import type { FileDiff, GraphNode } from "../../types/git";
import { ContextMenu } from "../shared/ContextMenu";

// VS Code-style branch lane palette (matches gitGraph extension defaults).
const lanePalette = [
  "#0078d4", // blue
  "#16825d", // green
  "#bf8803", // amber
  "#cd6e3e", // orange
  "#a371f7", // purple
  "#e96a83", // pink
  "#3093d6", // teal
  "#737373"  // grey
];

export function CommitGraph() {
  const { activeRepo } = useRepo();
  const runGit = useGit();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const theme = useSettingsStore((state) => state.theme);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; node: GraphNode } | null>(null);
  const [commitFileDiffs, setCommitFileDiffs] = useState<FileDiff[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { nodes, selectedCommitSha, selectedCommitDetail, isLoading, loadGraph, selectCommit } =
    useGraphStore();

  // Fetch full diff payload for the currently selected commit so we can show
  // file-level changes inline. Resets when the selection changes.
  useEffect(() => {
    if (!activeRepo || !selectedCommitSha) {
      setCommitFileDiffs([]);
      setSelectedFile(null);
      return;
    }
    let cancelled = false;
    void gitCommitDiff(activeRepo.path, selectedCommitSha)
      .then((diffs) => {
        if (cancelled) return;
        setCommitFileDiffs(diffs);
        setSelectedFile(diffs[0]?.file ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setCommitFileDiffs([]);
        setSelectedFile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRepo?.path, selectedCommitSha]);

  const activeFileDiff = useMemo(
    () => commitFileDiffs.find((diff) => diff.file === selectedFile) ?? null,
    [commitFileDiffs, selectedFile]
  );

  useEffect(() => {
    if (!activeRepo) {
      return;
    }

    void runGit(() => loadGraph(activeRepo));
  }, [activeRepo?.path]);

  const visibleNodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return nodes;
    }

    return nodes.filter((node) => {
      const haystack = `${node.message} ${node.author} ${node.refs.join(" ")}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [nodes, query]);
  const maxLane = useMemo(
    () => visibleLaneCount(visibleNodes),
    [visibleNodes]
  );
  const ROW_HEIGHT = 32;
  const LANE_WIDTH = 16;
  const rowVirtualizer = useVirtualizer({
    count: visibleNodes.length,
    estimateSize: () => ROW_HEIGHT,
    getScrollElement: () => scrollRef.current,
    overscan: 12
  });

  useEffect(() => {
    if (!selectedCommitSha) {
      return;
    }

    const index = visibleNodes.findIndex((node) => node.sha === selectedCommitSha);
    if (index >= 0) {
      rowVirtualizer.scrollToIndex(index, { align: "auto" });
    }
  }, [rowVirtualizer, selectedCommitSha, visibleNodes]);

  async function handleSelectCommit(sha: string) {
    if (!activeRepo) {
      return;
    }

    await runGit(() => selectCommit(activeRepo, sha));
  }

  async function handleCheckout(node: GraphNode) {
    if (!activeRepo) {
      return;
    }

    const target = inferCheckoutTarget(node);
    await runGit(async () => {
      await gitSwitchBranch(activeRepo.path, target);
      await refreshRepo(activeRepo.path);
      await loadGraph(activeRepo);
    });
  }

  async function handleCreateBranch(node: GraphNode) {
    if (!activeRepo) {
      return;
    }

    const name = window.prompt("Create branch from commit:", `branch/${node.shortSha}`);
    if (!name?.trim()) {
      return;
    }

    await runGit(async () => {
      await gitCreateBranch(activeRepo.path, name.trim(), node.sha);
      await loadGraph(activeRepo);
    });
  }

  async function handleCreateTag(node: GraphNode) {
    if (!activeRepo) {
      return;
    }

    const name = window.prompt("Create tag at commit:", `v${node.shortSha}`);
    if (!name?.trim()) {
      return;
    }

    await runGit(async () => {
      await gitCreateTag(activeRepo.path, name.trim(), node.sha);
      await loadGraph(activeRepo);
    });
  }

  async function handleCherryPick(node: GraphNode) {
    if (!activeRepo) {
      return;
    }

    await runGit(async () => {
      await gitCherryPick(activeRepo.path, node.sha);
      await refreshRepo(activeRepo.path);
      await loadGraph(activeRepo);
    });
  }

  if (!activeRepo) {
    return (
      <div className="empty-state">
        <div className="empty-state__card">
          <div className="empty-state__title">No repository loaded</div>
          <div className="empty-state__body">Load a repository to inspect its history graph.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-view">
      <GraphToolbar
        onQueryChange={setQuery}
        onReload={() => {
          void runGit(() => loadGraph(activeRepo));
        }}
        query={query}
      />

      <div className="graph-view__body">
        <section className="graph-list" ref={scrollRef}>
          {isLoading ? (
            <div className="scm-row scm-row--placeholder">
              <span className="scm-row__path">Loading history…</span>
            </div>
          ) : null}
          {!isLoading && visibleNodes.length === 0 ? (
            <div className="scm-row scm-row--placeholder">
              <span className="scm-row__path">No matching commits</span>
            </div>
          ) : null}
          <div
            className="graph-list__canvas"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((item) => {
              const node = visibleNodes[item.index];
              if (!node) {
                return null;
              }

              const isHead = node.refs.some(
                (ref) => ref.startsWith("HEAD") || ref === "HEAD"
              );
              const branchRefs = node.refs.filter((ref) => !ref.startsWith("tag: "));
              const tagRefs = node.refs.filter((ref) => ref.startsWith("tag: "));
              const laneColor = lanePalette[node.lane % lanePalette.length];
              const svgWidth = (maxLane + 1) * LANE_WIDTH;
              const centerY = ROW_HEIGHT / 2;

              return (
                <div
                  className="graph-list__row-wrap"
                  data-index={item.index}
                  key={node.sha}
                  style={{
                    transform: `translateY(${item.start}px)`,
                    height: `${ROW_HEIGHT}px`
                  }}
                >
                  <button
                    className={`graph-row ${node.sha === selectedCommitSha ? "is-active" : ""}`}
                    onClick={() => void handleSelectCommit(node.sha)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setMenu({ x: event.clientX, y: event.clientY, node });
                    }}
                    type="button"
                  >
                    <div className="graph-row__lane" style={{ width: `${svgWidth}px` }}>
                      <svg
                        className="graph-row__svg"
                        height={ROW_HEIGHT}
                        viewBox={`0 0 ${svgWidth} ${ROW_HEIGHT}`}
                        width={svgWidth}
                      >
                        {Array.from({ length: maxLane + 1 }).map((_, lane) => (
                          <line
                            key={`${node.sha}-lane-${lane}`}
                            stroke={
                              lane === node.lane
                                ? laneColor
                                : "var(--vscode-editorGroup-border)"
                            }
                            strokeOpacity={lane === node.lane ? 0.6 : 0.45}
                            strokeWidth="1.5"
                            x1={lane * LANE_WIDTH + LANE_WIDTH / 2}
                            x2={lane * LANE_WIDTH + LANE_WIDTH / 2}
                            y1={0}
                            y2={ROW_HEIGHT}
                          />
                        ))}
                        {node.connections.map((connection, index) => {
                          const fromX = connection.fromLane * LANE_WIDTH + LANE_WIDTH / 2;
                          const toX = connection.toLane * LANE_WIDTH + LANE_WIDTH / 2;
                          const stroke = lanePalette[connection.fromLane % lanePalette.length];
                          // Connection from this commit (centerY) toward the parent
                          // at the bottom of the row. Curves laterally if lanes differ.
                          const d =
                            fromX === toX
                              ? `M ${fromX} ${centerY} L ${fromX} ${ROW_HEIGHT}`
                              : `M ${fromX} ${centerY} C ${fromX} ${ROW_HEIGHT - 4}, ${toX} ${centerY + 4}, ${toX} ${ROW_HEIGHT}`;
                          return (
                            <path
                              d={d}
                              fill="none"
                              key={`${node.sha}-edge-${index}`}
                              stroke={stroke}
                              strokeLinecap="round"
                              strokeWidth="2"
                            />
                          );
                        })}
                        <circle
                          cx={node.lane * LANE_WIDTH + LANE_WIDTH / 2}
                          cy={centerY}
                          fill={laneColor}
                          r="4.5"
                          stroke="var(--vscode-editor-background)"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <div className="graph-row__content">
                      <div className="graph-row__title">
                        <span className="graph-row__message">{node.message}</span>
                        {isHead ? <span className="graph-row__head">HEAD</span> : null}
                        {branchRefs.map((ref) => (
                          <span
                            className="graph-row__ref"
                            key={`${node.sha}-ref-${ref}`}
                          >
                            {ref.replace(/^HEAD -> /, "")}
                          </span>
                        ))}
                        {tagRefs.map((ref) => (
                          <span
                            className="graph-row__tag"
                            key={`${node.sha}-tag-${ref}`}
                          >
                            {ref.replace(/^tag: /, "")}
                          </span>
                        ))}
                      </div>
                      <div className="graph-row__meta">
                        <span className="graph-row__sha">{node.shortSha}</span>
                        <span>{node.author}</span>
                        <span>{node.date}</span>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="graph-detail">
          {selectedCommitDetail ? (
            <>
              <div className="graph-detail__header">
                <div>{selectedCommitDetail.message}</div>
                <div className="file-row__path">{selectedCommitDetail.sha}</div>
              </div>
              <div className="graph-detail__meta">
                <span>{selectedCommitDetail.author}</span>
                <span>{selectedCommitDetail.authorEmail}</span>
                <span>{selectedCommitDetail.date}</span>
              </div>
              {selectedCommitDetail.body ? (
                <pre className="graph-detail__body">{selectedCommitDetail.body}</pre>
              ) : null}
              <div className="graph-detail__files">
                <div className="graph-detail__files-title">
                  Changed Files ({selectedCommitDetail.files.length})
                </div>
                {selectedCommitDetail.files.map((file) => {
                  const isActive = selectedFile === file.file;
                  return (
                    <div
                      className={`scm-row${isActive ? " is-selected" : ""}`}
                      key={`${selectedCommitDetail.sha}-${file.file}`}
                      onClick={() => setSelectedFile(file.file)}
                      role="treeitem"
                    >
                      <FileIcon path={file.file} size={16} className="scm-row__icon" />
                      <span className="scm-row__name" title={file.file}>
                        {file.file.split("/").pop()}
                      </span>
                      <span className="scm-row__path" title={file.file}>
                        +{file.additions} -{file.deletions}
                      </span>
                      <span className="scm-row__status">{file.status}</span>
                    </div>
                  );
                })}
              </div>

              {activeFileDiff ? (
                <div className="graph-detail__diff">
                  <div className="graph-detail__diff-title" title={activeFileDiff.file}>
                    <FileIcon path={activeFileDiff.file} size={14} />
                    <span>{activeFileDiff.file}</span>
                  </div>
                  {activeFileDiff.isBinary ? (
                    <div className="diff-viewer__placeholder">
                      Binary file — no textual diff.
                    </div>
                  ) : activeFileDiff.hunks.length === 0 ? (
                    <div className="diff-viewer__placeholder">
                      No textual changes to display.
                    </div>
                  ) : (
                    activeFileDiff.hunks.map((hunk, index) => (
                      <DiffHunk
                        filePath={activeFileDiff.file}
                        hunk={hunk}
                        hunkIndex={index}
                        isActive={false}
                        key={`${activeFileDiff.file}-${hunk.header}-${index}`}
                        mode="inline"
                        onFocus={() => {}}
                        onToggleLine={() => {}}
                        selectedLineIndices={[]}
                        theme={theme}
                      />
                    ))
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <div className="graph-detail__empty">
              <Codicon name="git-commit" size={16} />
              <span>Select a commit</span>
            </div>
          )}
        </aside>
      </div>
      <ContextMenu
        items={
          menu
            ? [
                {
                  label: "Checkout Here",
                  onSelect: () => {
                    void handleCheckout(menu.node);
                  }
                },
                {
                  label: "Create Branch Here",
                  onSelect: () => {
                    void handleCreateBranch(menu.node);
                  }
                },
                {
                  label: "Create Tag Here",
                  onSelect: () => {
                    void handleCreateTag(menu.node);
                  }
                },
                {
                  label: "Cherry-pick Commit",
                  onSelect: () => {
                    void handleCherryPick(menu.node);
                  }
                },
                {
                  label: "Copy SHA",
                  onSelect: () => {
                    void navigator.clipboard.writeText(menu.node.sha);
                  }
                }
              ]
            : []
        }
        onClose={() => setMenu(null)}
        position={menu ? { x: menu.x, y: menu.y } : null}
      />
    </div>
  );
}

function visibleLaneCount(nodes: typeof useGraphStore extends never ? never : Array<{ lane: number; connections: Array<{ toLane: number }> }>) {
  return nodes.reduce((max, node) => {
    const connectionMax = node.connections.reduce(
      (innerMax, connection) => Math.max(innerMax, connection.toLane),
      node.lane
    );
    return Math.max(max, connectionMax);
  }, 0);
}

function inferCheckoutTarget(node: GraphNode) {
  const headRef = node.refs.find((ref) => ref.startsWith("HEAD -> "));
  if (headRef) {
    return headRef.replace("HEAD -> ", "").trim();
  }

  const localRef = node.refs.find((ref) => !ref.startsWith("origin/") && !ref.startsWith("tag: "));
  return localRef ?? node.sha;
}
