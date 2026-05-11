import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ContextMenu } from "../shared/ContextMenu";
import { InputModal } from "../shared/InputModal";
import { useGit } from "../../hooks/useGit";
import { useRepo } from "../../hooks/useRepo";
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

const ROW_HEIGHT = 32;
const LANE_WIDTH = 16;

interface PendingInput {
  kind: "create-branch" | "create-tag";
  title: string;
  label: string;
  initialValue?: string;
  node: GraphNode;
}

export function CommitGraphList() {
  const { activeRepo } = useRepo();
  const runGit = useGit();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; node: GraphNode } | null>(null);
  const [input, setInput] = useState<PendingInput | null>(null);
  const { nodes, selectedCommitSha, isLoading, loadGraph, selectCommit } = useGraphStore();

  useEffect(() => {
    if (!activeRepo) return;
    void runGit(() => loadGraph(activeRepo)).catch(() => {});
  }, [activeRepo?.path]);

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
    if (!activeRepo) return;
    await runGit(() => selectCommit(activeRepo, sha)).catch(() => {});
  }

  function handleCheckout(node: GraphNode) {
    if (!activeRepo) return;
    const target = inferCheckoutTarget(node);
    runGit(async () => {
      await gitSwitchBranch(activeRepo.path, target);
      await refreshRepo(activeRepo.path);
      await loadGraph(activeRepo);
    }).catch(() => {});
  }

  function handleCherryPick(node: GraphNode) {
    if (!activeRepo) return;
    runGit(async () => {
      await gitCherryPick(activeRepo.path, node.sha);
      await refreshRepo(activeRepo.path);
      await loadGraph(activeRepo);
    }).catch(() => {});
  }

  function handleInputSubmit(value: string) {
    if (!input || !activeRepo) return;
    const repoPath = activeRepo.path;
    const node = input.node;
    runGit(async () => {
      if (input.kind === "create-branch") {
        await gitCreateBranch(repoPath, value, node.sha);
      } else {
        await gitCreateTag(repoPath, value, node.sha);
      }
      await loadGraph(activeRepo);
    }).catch(() => {});
  }

  if (!activeRepo) {
    return (
      <div className="scm-welcome">
        <p className="scm-welcome__lead">No repository loaded.</p>
      </div>
    );
  }

  return (
    <>
      <GraphToolbar
        onQueryChange={setQuery}
        onReload={() => {
          void runGit(() => loadGraph(activeRepo)).catch(() => {});
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
