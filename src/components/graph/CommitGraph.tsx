import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { GitCommitHorizontal } from "lucide-react";
import { useRepo } from "../../hooks/useRepo";
import { useGit } from "../../hooks/useGit";
import { useGraphStore } from "../../stores/graph";
import { useWorkspaceStore } from "../../stores/workspace";
import { gitCherryPick, gitCreateBranch, gitCreateTag, gitSwitchBranch } from "../../lib/git";
import { GraphToolbar } from "./GraphToolbar";
import type { GraphNode } from "../../types/git";
import { ContextMenu } from "../shared/ContextMenu";

const lanePalette = ["#66d9ef", "#5edb95", "#f2c572", "#ff7b72", "#8aa7ff", "#ff9dd6"];

export function CommitGraph() {
  const { activeRepo } = useRepo();
  const runGit = useGit();
  const refreshRepo = useWorkspaceStore((state) => state.refreshRepo);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; node: GraphNode } | null>(null);
  const { nodes, selectedCommitSha, selectedCommitDetail, isLoading, loadGraph, selectCommit } =
    useGraphStore();

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
  const rowVirtualizer = useVirtualizer({
    count: visibleNodes.length,
    estimateSize: () => 78,
    getScrollElement: () => scrollRef.current,
    measureElement: (element) => element?.getBoundingClientRect().height ?? 78,
    overscan: 10
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
            <div className="file-row">
              <div className="file-row__left">
                <span className="file-row__path">Loading history…</span>
              </div>
            </div>
          ) : null}
          {!isLoading && visibleNodes.length === 0 ? (
            <div className="file-row">
              <div className="file-row__left">
                <span className="file-row__path">No matching commits</span>
              </div>
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

              return (
                <div
                  className="graph-list__row-wrap"
                  data-index={item.index}
                  key={node.sha}
                  ref={rowVirtualizer.measureElement}
                  style={{ transform: `translateY(${item.start}px)` }}
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
                    <div className="graph-row__lane">
                      <svg
                        className="graph-row__svg"
                        height="56"
                        viewBox={`0 0 ${(maxLane + 1) * 18} 56`}
                        width={(maxLane + 1) * 18}
                      >
                        {Array.from({ length: maxLane + 1 }).map((_, lane) => (
                          <line
                            key={`${node.sha}-lane-${lane}`}
                            stroke="rgba(139, 161, 182, 0.18)"
                            strokeWidth="1"
                            x1={lane * 18 + 9}
                            x2={lane * 18 + 9}
                            y1="0"
                            y2="56"
                          />
                        ))}
                        {node.connections.map((connection, index) => {
                          const fromX = connection.fromLane * 18 + 9;
                          const toX = connection.toLane * 18 + 9;
                          const stroke = lanePalette[connection.fromLane % lanePalette.length];
                          return (
                            <path
                              d={`M ${fromX} 10 L ${fromX} 28 ${toX === fromX ? "" : `L ${toX} 46`}`}
                              fill="none"
                              key={`${node.sha}-edge-${index}`}
                              stroke={stroke}
                              strokeLinecap="round"
                              strokeWidth="2.5"
                            />
                          );
                        })}
                        <circle
                          cx={node.lane * 18 + 9}
                          cy="10"
                          fill={lanePalette[node.lane % lanePalette.length]}
                          r="6"
                        />
                      </svg>
                    </div>
                    <div className="graph-row__content">
                      <div className="graph-row__title">
                        <span>{node.message}</span>
                        <span className="file-row__path">{node.shortSha}</span>
                      </div>
                      <div className="graph-row__meta">
                        <span>{node.author}</span>
                        <span>{node.date}</span>
                        {node.refs.map((ref) => (
                          <span className="badge" key={`${node.sha}-${ref}`}>
                            {ref}
                          </span>
                        ))}
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
              <div className="repo-card__section">
                <div className="repo-card__section-header">
                  <span>Changed Files</span>
                </div>
                <div className="file-list">
                  {selectedCommitDetail.files.map((file) => (
                    <div className="file-row" key={`${selectedCommitDetail.sha}-${file.file}`}>
                      <div className="file-row__left">
                        <div className="badge">{file.status}</div>
                        <div>
                          <div className="file-row__name">{file.file}</div>
                          <div className="file-row__path">
                            +{file.additions} -{file.deletions}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state__card">
                <div className="empty-state__title">
                  <GitCommitHorizontal size={18} /> Select a commit
                </div>
                <div className="empty-state__body">
                  Click any graph row to load commit details and changed files.
                </div>
              </div>
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
