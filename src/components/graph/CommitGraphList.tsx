import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ContextMenu } from "../shared/ContextMenu";
import { InputModal } from "../shared/InputModal";
import { useGit } from "../../hooks/useGit";
import { useGraphStore } from "../../stores/graph";
import { useWorkspaceStore } from "../../stores/workspace";
import {
  gitCherryPick,
  gitCreateBranch,
  gitCreateTag,
  gitSwitchBranch
} from "../../lib/git";
import { GraphToolbar } from "./GraphToolbar";
import type { GraphNode } from "../../types/git";

// VS Code-style branch lane palette.
const lanePalette = [
  "#0078d4",
  "#16825d",
  "#bf8803",
  "#cd6e3e",
  "#a371f7",
  "#e96a83",
  "#3093d6",
  "#737373"
];

const ROW_HEIGHT = 24;
const LANE_WIDTH = 12;
const MAX_VISIBLE_LANES = 7;

interface PendingInput {
  kind: "create-branch" | "create-tag";
  title: string;
  label: string;
  initialValue?: string;
  node: GraphNode;
}

export function CommitGraphList() {
  const runGit = useGit();
  const repositories = useWorkspaceStore((state) => state.repositories);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const setActiveRepo = useWorkspaceStore((state) => state.setActiveRepo);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; node: GraphNode } | null>(null);
  const [input, setInput] = useState<PendingInput | null>(null);
  const {
    nodes,
    repoId,
    selectedCommitSha,
    isLoading,
    loadGraph,
    selectCommit,
    setRepoId
  } = useGraphStore();

  const selectedRepo =
    repositories.find((repo) => repo.id === repoId) ?? repositories[0] ?? null;

  useEffect(() => {
    if (repositories.length === 0) {
      setRepoId(null);
      return;
    }

    if (!selectedRepo) {
      setRepoId(repositories[0]!.id);
    }
  }, [repositories, selectedRepo, setRepoId]);

  useEffect(() => {
    if (!selectedRepo) return;
    setActiveRepo(selectedRepo.id);
    void runGit(() => loadGraph(selectedRepo)).catch(() => {});
  }, [loadGraph, runGit, selectedRepo, setActiveRepo]);

  const visibleNodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return nodes;
    return nodes.filter((node) => {
      const haystack = `${node.message} ${node.author} ${node.refs.join(" ")}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [nodes, query]);

  const maxLane = useMemo(() => visibleLaneCount(visibleNodes), [visibleNodes]);
  const rowVirtualizer = useVirtualizer({
    count: visibleNodes.length,
    estimateSize: () => ROW_HEIGHT,
    getScrollElement: () => scrollRef.current,
    overscan: 12
  });

  useEffect(() => {
    if (!selectedCommitSha) return;
    const index = visibleNodes.findIndex((node) => node.sha === selectedCommitSha);
    if (index >= 0) {
      rowVirtualizer.scrollToIndex(index, { align: "auto" });
    }
  }, [rowVirtualizer, selectedCommitSha, visibleNodes]);

  async function handleSelectCommit(sha: string) {
    if (!selectedRepo) return;
    setActiveRepo(selectedRepo.id);
    await runGit(() => selectCommit(selectedRepo, sha)).catch(() => {});
  }

  function handleCheckout(node: GraphNode) {
    if (!selectedRepo) return;
    const target = inferCheckoutTarget(node);
    runGit(async () => {
      setActiveRepo(selectedRepo.id);
      await gitSwitchBranch(selectedRepo.path, target);
      await refreshRepo(selectedRepo.path);
      await loadGraph(selectedRepo);
    }).catch(() => {});
  }

  function handleCherryPick(node: GraphNode) {
    if (!selectedRepo) return;
    runGit(async () => {
      setActiveRepo(selectedRepo.id);
      await gitCherryPick(selectedRepo.path, node.sha);
      await refreshRepo(selectedRepo.path);
      await loadGraph(selectedRepo);
    }).catch(() => {});
  }

  function handleInputSubmit(value: string) {
    if (!input || !selectedRepo) return;
    const repoPath = selectedRepo.path;
    const node = input.node;
    runGit(async () => {
      if (input.kind === "create-branch") {
        await gitCreateBranch(repoPath, value, node.sha);
      } else {
        await gitCreateTag(repoPath, value, node.sha);
      }
      await loadGraph(selectedRepo);
    }).catch(() => {});
  }

  if (!selectedRepo) {
    return (
      <div className="scm-welcome">
        <p className="scm-welcome__lead">No repository loaded.</p>
      </div>
    );
  }

  return (
    <>
      <GraphToolbar
        repositories={repositories}
        selectedRepoId={selectedRepo.id}
        onRepoChange={(nextRepoId) => setRepoId(nextRepoId)}
        onQueryChange={setQuery}
        onReload={() => {
          void runGit(() => loadGraph(selectedRepo)).catch(() => {});
        }}
        query={query}
      />

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
            if (!node) return null;

            const isHead = node.refs.some(
              (ref) => ref.startsWith("HEAD") || ref === "HEAD"
            );
            const branchRefs = node.refs.filter((ref) => !ref.startsWith("tag: "));
            const tagRefs = node.refs.filter((ref) => ref.startsWith("tag: "));
            const laneColor = lanePalette[node.lane % lanePalette.length];
            const laneWindow = getLaneWindow(node, maxLane);
            const svgWidth = laneWindow.count * LANE_WIDTH;
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
                      {Array.from({ length: laneWindow.count }).map((_, laneOffset) => {
                        const lane = laneWindow.start + laneOffset;
                        return (
                        <line
                          key={`${node.sha}-lane-${lane}`}
                          stroke={
                            lane === node.lane
                              ? laneColor
                              : "var(--vscode-editorGroup-border)"
                          }
                          strokeOpacity={lane === node.lane ? 0.6 : 0.45}
                          strokeWidth="1.5"
                          x1={laneOffset * LANE_WIDTH + LANE_WIDTH / 2}
                          x2={laneOffset * LANE_WIDTH + LANE_WIDTH / 2}
                          y1={0}
                          y2={ROW_HEIGHT}
                        />
                        );
                      })}
                      {node.connections.map((connection, index) => {
                        const fromX =
                          clampLane(connection.fromLane - laneWindow.start, laneWindow.count) *
                            LANE_WIDTH +
                          LANE_WIDTH / 2;
                        const toX =
                          clampLane(connection.toLane - laneWindow.start, laneWindow.count) *
                            LANE_WIDTH +
                          LANE_WIDTH / 2;
                        const stroke = lanePalette[connection.fromLane % lanePalette.length];
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
                        cx={
                          (node.lane - laneWindow.start) * LANE_WIDTH + LANE_WIDTH / 2
                        }
                        cy={centerY}
                        fill={laneColor}
                        r="4.5"
                        stroke="var(--vscode-editor-background)"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <div className="graph-row__content">
                    <span className="graph-row__message" title={node.message}>
                      {node.message}
                    </span>
                    {isHead || branchRefs.length > 0 || tagRefs.length > 0 ? (
                      <div className="graph-row__refs">
                        {isHead ? <span className="graph-row__head">HEAD</span> : null}
                        {branchRefs.map((ref) => (
                          <span
                            className="graph-row__ref"
                            key={`${node.sha}-ref-${ref}`}
                            title={ref}
                          >
                            {ref.replace(/^HEAD -> /, "")}
                          </span>
                        ))}
                        {tagRefs.map((ref) => (
                          <span
                            className="graph-row__tag"
                            key={`${node.sha}-tag-${ref}`}
                            title={ref}
                          >
                            {ref.replace(/^tag: /, "")}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <span className="graph-row__author" title={node.author}>
                      {node.author}
                    </span>
                    <span className="graph-row__date" title={node.date}>
                      {formatRelativeTime(node.date)}
                    </span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <ContextMenu
        items={
          menu
            ? [
                { label: "Checkout Here", onSelect: () => handleCheckout(menu.node) },
                {
                  label: "Create Branch Here…",
                  onSelect: () =>
                    setInput({
                      kind: "create-branch",
                      title: "Create Branch",
                      label: `Create new branch from ${menu.node.shortSha}:`,
                      initialValue: `branch/${menu.node.shortSha}`,
                      node: menu.node
                    })
                },
                {
                  label: "Create Tag Here…",
                  onSelect: () =>
                    setInput({
                      kind: "create-tag",
                      title: "Create Tag",
                      label: `Create new tag at ${menu.node.shortSha}:`,
                      initialValue: `v${menu.node.shortSha}`,
                      node: menu.node
                    })
                },
                {
                  label: "Cherry-pick Commit",
                  onSelect: () => handleCherryPick(menu.node)
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

      <InputModal
        isOpen={input !== null}
        title={input?.title ?? ""}
        label={input?.label ?? ""}
        initialValue={input?.initialValue}
        onSubmit={handleInputSubmit}
        onClose={() => setInput(null)}
      />
    </>
  );
}

function getLaneWindow(node: GraphNode, maxLane: number) {
  const count = Math.min(maxLane + 1, MAX_VISIBLE_LANES);
  const maxStart = Math.max(0, maxLane + 1 - count);
  const start = Math.max(0, Math.min(node.lane - 1, maxStart));
  return { start, count };
}

function clampLane(relativeLane: number, count: number) {
  return Math.max(0, Math.min(relativeLane, count - 1));
}

/** Shows "5m", "2d", "3w", "1y" etc. given an ISO 8601 timestamp. */
function formatRelativeTime(iso: string): string {
  const date = Date.parse(iso);
  if (!Number.isFinite(date)) return "";
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 86_400 * 7) return `${Math.floor(seconds / 86_400)}d`;
  if (seconds < 86_400 * 30) return `${Math.floor(seconds / (86_400 * 7))}w`;
  if (seconds < 86_400 * 365) return `${Math.floor(seconds / (86_400 * 30))}mo`;
  return `${Math.floor(seconds / (86_400 * 365))}y`;
}

function visibleLaneCount(
  nodes: Array<{ lane: number; connections: Array<{ toLane: number }> }>
) {
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
  const localRef = node.refs.find(
    (ref) => !ref.startsWith("origin/") && !ref.startsWith("tag: ")
  );
  return localRef ?? node.sha;
}
