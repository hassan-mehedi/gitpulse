import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ContextMenu } from "../shared/ContextMenu";
import { InputModal } from "../shared/InputModal";
import { ConfirmModal } from "../shared/ConfirmModal";
import { useGit } from "../../hooks/useGit";
import { useGraphStore } from "../../stores/graph";
import { useWorkspaceStore } from "../../stores/workspace";
import {
  gitCherryPick,
  gitCreateBranch,
  gitCreateTag,
  gitPull,
  gitPush,
  gitRebaseInteractive,
  gitSwitchBranch
} from "../../lib/git";
import { GraphToolbar } from "./GraphToolbar";
import { InteractiveRebaseModal } from "../rebase/InteractiveRebaseModal";
import type { ActivityView, GraphNode } from "../../types/git";

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
const LANE_WIDTH = 18;
const MAX_VISIBLE_LANES = 8;

interface PendingInput {
  kind: "create-branch" | "create-tag";
  title: string;
  label: string;
  initialValue?: string;
  node: GraphNode;
}

interface CommitGraphListProps {
  onNavigateToView?: (view: ActivityView) => void;
}

export function CommitGraphList({ onNavigateToView }: CommitGraphListProps) {
  const runGit = useGit();
  const repositories = useWorkspaceStore((state) => state.repositories);
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const setActiveRepo = useWorkspaceStore((state) => state.setActiveRepo);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; node: GraphNode } | null>(null);
  const [input, setInput] = useState<PendingInput | null>(null);
  const [rebaseTarget, setRebaseTarget] = useState<GraphNode | null>(null);
  const [confirmForcePush, setConfirmForcePush] = useState(false);
  const [hiddenRefs, setHiddenRefs] = useState<string[]>([]);
  const [dateMode, setDateMode] = useState<"relative" | "absolute">("relative");
  const [draggedSha, setDraggedSha] = useState<string | null>(null);
  const {
    nodes,
    repoId,
    selectedCommitSha,
    isLoading,
    includeAll,
    loadGraph,
    selectCommit,
    setRepoId,
    setIncludeAll
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

  const availableRefs = useMemo(
    () =>
      Array.from(
        new Set(
          nodes.flatMap((node) =>
            node.refs.filter((ref) => !ref.startsWith("tag: ") && ref !== "HEAD")
          )
        )
      ).sort((left, right) => left.localeCompare(right)),
    [nodes]
  );

  const visibleNodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return nodes.filter((node) => {
      const visibleByRef =
        hiddenRefs.length === 0 ||
        node.refs.length === 0 ||
        node.refs.some((ref) => ref.startsWith("tag: ") || ref === "HEAD" || !hiddenRefs.includes(ref));
      if (!visibleByRef) return false;
      if (!needle) return true;
      const haystack = `${node.message} ${node.author} ${node.refs.join(" ")}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [hiddenRefs, nodes, query]);

  const maxLane = useMemo(() => visibleLaneCount(visibleNodes), [visibleNodes]);
  const headNode = useMemo(
    () =>
      visibleNodes.find((node) =>
        node.refs.some((ref) => ref.startsWith("HEAD") || ref === "HEAD")
      ) ?? null,
    [visibleNodes]
  );
  const headColorId = headNode?.colorId ?? null;
  const headLane = headNode?.lane ?? 0;
  const pendingCount =
    (selectedRepo?.changes.length ?? 0) + (selectedRepo?.staged.length ?? 0);
  const hasPending = pendingCount > 0;
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

  function toggleRef(ref: string) {
    setHiddenRefs((current) =>
      current.includes(ref) ? current.filter((item) => item !== ref) : [...current, ref]
    );
  }

  function handleDropReorder(targetSha: string) {
    if (!selectedRepo || !draggedSha || draggedSha === targetSha) return;
    const fromIndex = visibleNodes.findIndex((node) => node.sha === draggedSha);
    const toIndex = visibleNodes.findIndex((node) => node.sha === targetSha);
    if (fromIndex < 0 || toIndex < 0) return;
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const range = visibleNodes.slice(start, end + 1);
    const base = visibleNodes[end + 1];
    if (!base || range.some((node) => node.isMerge)) return;
    const reordered = range.slice();
    const [moved] = reordered.splice(fromIndex - start, 1);
    if (!moved) return;
    reordered.splice(toIndex - start, 0, moved);
    const todo = reordered.reverse().map((node) => `pick ${node.sha} ${node.message}`);
    runGit(async () => {
      await gitRebaseInteractive(selectedRepo.path, base.sha, todo);
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
        includeAll={includeAll}
        onIncludeAllChange={(value) => {
          setIncludeAll(value);
          void runGit(() => loadGraph(selectedRepo)).catch(() => {});
        }}
        activeRepo={selectedRepo}
        onPull={() => {
          void runGit(async () => {
            await gitPull(selectedRepo.path);
            await refreshRepo(selectedRepo.path);
            await loadGraph(selectedRepo);
          }).catch(() => {});
        }}
        onPush={() => {
          void runGit(async () => {
            await gitPush(selectedRepo.path);
            await refreshRepo(selectedRepo.path);
            await loadGraph(selectedRepo);
          }).catch(() => {});
        }}
        onForcePush={() => setConfirmForcePush(true)}
        availableRefs={availableRefs}
        hiddenRefs={hiddenRefs}
        onToggleRef={toggleRef}
        dateMode={dateMode}
        onDateModeChange={setDateMode}
      />
      <ConfirmModal
        isOpen={confirmForcePush}
        title="Force Push With Lease"
        body={
          <>
            Force push <strong>{selectedRepo.branch}</strong> using{" "}
            <strong>--force-with-lease</strong>?
          </>
        }
        confirmLabel="Force Push"
        danger
        onConfirm={() => {
          void runGit(async () => {
            await gitPush(selectedRepo.path, undefined, undefined, true);
            await refreshRepo(selectedRepo.path);
            await loadGraph(selectedRepo);
          }).catch(() => {});
        }}
        onClose={() => setConfirmForcePush(false)}
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
        {headColorId !== null ? (
          <div
            aria-hidden
            className="graph-list__head-stripe"
            style={{ background: colorFor(headColorId) }}
          />
        ) : null}
        {hasPending && headColorId !== null ? (
          <WorkingTreeRow
            colorId={headColorId}
            lane={headLane}
            laneWindow={getLaneWindow(maxLane)}
            modifiedCount={selectedRepo?.changes.length ?? 0}
            stagedCount={selectedRepo?.staged.length ?? 0}
            onClick={() => onNavigateToView?.("source-control")}
          />
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
            const laneColor = colorFor(node.colorId);
            const laneWindow = getLaneWindow(maxLane);
            const svgWidth = laneWindow.count * LANE_WIDTH;
            const centerY = ROW_HEIGHT / 2;
            // Lane occupancy ON this row: union of lanes coming in from above
            // and lanes going out to below. This gives us the actual "live"
            // lanes — both passing-through and ones starting/ending here.
            const laneOccupancy = new Map<number, { topColor?: number; bottomColor?: number }>();
            for (const pass of node.lanesIn) {
              const entry = laneOccupancy.get(pass.lane) ?? {};
              entry.topColor = pass.colorId;
              laneOccupancy.set(pass.lane, entry);
            }
            for (const pass of node.lanesOut) {
              const entry = laneOccupancy.get(pass.lane) ?? {};
              entry.bottomColor = pass.colorId;
              laneOccupancy.set(pass.lane, entry);
            }
            // The commit's own lane is always present (the dot lives there).
            const ownEntry = laneOccupancy.get(node.lane) ?? {};
            if (ownEntry.topColor === undefined) ownEntry.topColor = node.colorId;
            if (ownEntry.bottomColor === undefined) ownEntry.bottomColor = node.colorId;
            laneOccupancy.set(node.lane, ownEntry);

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
                  className={`graph-row ${node.sha === selectedCommitSha ? "is-active" : ""} ${draggedSha === node.sha ? "is-dragging" : ""}`}
                  onClick={() => void handleSelectCommit(node.sha)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({ x: event.clientX, y: event.clientY, node });
                  }}
                  draggable={!node.isMerge}
                  onDragStart={(event) => {
                    setDraggedSha(node.sha);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    if (draggedSha && draggedSha !== node.sha) {
                      event.preventDefault();
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleDropReorder(node.sha);
                    setDraggedSha(null);
                  }}
                  onDragEnd={() => setDraggedSha(null)}
                  type="button"
                >
                  <div className="graph-row__lane" style={{ width: `${svgWidth}px` }}>
                    <svg
                      className="graph-row__svg"
                      height={ROW_HEIGHT}
                      viewBox={`0 0 ${svgWidth} ${ROW_HEIGHT}`}
                      width={svgWidth}
                    >
                      {/* Continuous colored lane lines for every live lane on
                          this row. Drawn first so edges and dot sit on top. */}
                      {Array.from(laneOccupancy.entries()).map(([lane, entry]) => {
                        const x = laneX(lane, laneWindow);
                        const lines: JSX.Element[] = [];
                        if (entry.topColor !== undefined) {
                          lines.push(
                            <line
                              key={`${node.sha}-lane-${lane}-top`}
                              stroke={colorFor(entry.topColor)}
                              strokeOpacity={0.95}
                              strokeWidth="2"
                              x1={x}
                              x2={x}
                              y1={0}
                              y2={centerY}
                            />
                          );
                        }
                        if (entry.bottomColor !== undefined) {
                          lines.push(
                            <line
                              key={`${node.sha}-lane-${lane}-bot`}
                              stroke={colorFor(entry.bottomColor)}
                              strokeOpacity={0.95}
                              strokeWidth="2"
                              x1={x}
                              x2={x}
                              y1={centerY}
                              y2={ROW_HEIGHT}
                            />
                          );
                        }
                        return <g key={`${node.sha}-lane-${lane}`}>{lines}</g>;
                      })}
                      {/* Curves to non-trunk parents (fork / merge edges) */}
                      {node.connections
                        .filter((c) => c.fromLane !== c.toLane)
                        .map((connection, index) => {
                          const fromX = laneX(connection.fromLane, laneWindow);
                          const toX = laneX(connection.toLane, laneWindow);
                          const stroke = colorFor(connection.colorId);
                          const d = `M ${fromX} ${centerY} C ${fromX} ${ROW_HEIGHT - 2}, ${toX} ${centerY + 2}, ${toX} ${ROW_HEIGHT}`;
                          return (
                            <path
                              d={d}
                              fill="none"
                              key={`${node.sha}-edge-${index}`}
                              stroke={stroke}
                              strokeLinecap="round"
                              strokeWidth={connection.isFirstParent ? 2.25 : 2}
                            />
                          );
                        })}
                      {/* Commit dot — ring for merges, filled for regular */}
                      <circle
                        cx={laneX(node.lane, laneWindow)}
                        cy={centerY}
                        fill={node.isMerge ? "var(--vscode-editor-background)" : laneColor}
                        r={isHead ? 5 : 4.5}
                        stroke={laneColor}
                        strokeWidth={node.isMerge ? 2 : 2}
                      />
                      {isSigned(node.signature) ? (
                        <circle
                          cx={laneX(node.lane, laneWindow) + 5}
                          cy={centerY - 5}
                          fill="var(--vscode-testing-iconPassed, #73c991)"
                          r="2.4"
                          stroke="var(--vscode-editor-background)"
                          strokeWidth="1"
                        />
                      ) : null}
                    </svg>
                  </div>
                  <div className="graph-row__content">
                    <span
                      className="graph-row__avatar"
                      title={node.authorEmail || node.author}
                      style={{ background: avatarColor(node.authorEmail || node.author) }}
                    >
                      {avatarInitials(node.author)}
                    </span>
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
                      {dateMode === "relative" ? formatRelativeTime(node.date) : formatAbsoluteTime(node.date)}
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
                  label: "Rebase Commits Onto Here…",
                  onSelect: () => setRebaseTarget(menu.node)
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

      {rebaseTarget && selectedRepo ? (
        <InteractiveRebaseModal
          isOpen
          repoPath={selectedRepo.path}
          baseSha={rebaseTarget.sha}
          baseShortSha={rebaseTarget.shortSha}
          onClose={() => setRebaseTarget(null)}
          onComplete={() => {
            setRebaseTarget(null);
            void runGit(async () => {
              await refreshRepo(selectedRepo.path);
              await loadGraph(selectedRepo);
            }).catch(() => {});
          }}
        />
      ) : null}
    </>
  );
}

interface LaneWindow {
  start: number;
  count: number;
}

function getLaneWindow(maxLane: number): LaneWindow {
  const count = Math.min(maxLane + 1, MAX_VISIBLE_LANES);
  return { start: 0, count };
}

function laneX(lane: number, window: LaneWindow) {
  const relative = Math.max(0, Math.min(lane - window.start, window.count - 1));
  return relative * LANE_WIDTH + LANE_WIDTH / 2;
}

function colorFor(colorId: number) {
  return lanePalette[colorId % lanePalette.length];
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

function formatAbsoluteTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "2-digit",
    month: "short",
    day: "2-digit"
  });
}

function isSigned(signature: string) {
  return signature && signature !== "N";
}

function avatarInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function avatarColor(seed: string) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 48% 36%)`;
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

interface WorkingTreeRowProps {
  colorId: number;
  lane: number;
  laneWindow: LaneWindow;
  modifiedCount: number;
  stagedCount: number;
  onClick: () => void;
}

function WorkingTreeRow({
  colorId,
  lane,
  laneWindow,
  modifiedCount,
  stagedCount,
  onClick
}: WorkingTreeRowProps) {
  const color = colorFor(colorId);
  const svgWidth = laneWindow.count * LANE_WIDTH;
  const centerY = ROW_HEIGHT / 2;
  const cx = laneX(lane, laneWindow);
  return (
    <button
      className="graph-row graph-row--working-tree"
      onClick={onClick}
      type="button"
      title="Open Source Control"
    >
      <div className="graph-row__lane" style={{ width: `${svgWidth}px` }}>
        <svg
          className="graph-row__svg"
          height={ROW_HEIGHT}
          viewBox={`0 0 ${svgWidth} ${ROW_HEIGHT}`}
          width={svgWidth}
        >
          {/* Dashed line connecting the working-tree dot to HEAD below */}
          <line
            stroke={color}
            strokeOpacity={0.7}
            strokeWidth="2"
            strokeDasharray="2 3"
            x1={cx}
            x2={cx}
            y1={centerY}
            y2={ROW_HEIGHT}
          />
          {/* Hollow dashed circle distinguishes uncommitted state */}
          <circle
            cx={cx}
            cy={centerY}
            fill="var(--vscode-editor-background)"
            r={4.5}
            stroke={color}
            strokeWidth="2"
            strokeDasharray="2 1.5"
          />
        </svg>
      </div>
      <div className="graph-row__content">
        <span className="graph-row__message">Working Tree</span>
        <div className="graph-row__refs">
          {stagedCount > 0 ? (
            <span className="graph-row__ref" title={`${stagedCount} staged`}>
              {stagedCount} staged
            </span>
          ) : null}
          {modifiedCount > 0 ? (
            <span className="graph-row__ref" title={`${modifiedCount} changed`}>
              {modifiedCount} changed
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
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
