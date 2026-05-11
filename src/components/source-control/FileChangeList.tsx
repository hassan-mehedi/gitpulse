import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Codicon, type CodiconName } from "../shared/Codicon";
import type { FileChange, Repository } from "../../types/git";
import { FileChangeRow } from "./FileChangeRow";

export interface FileChangeListAction {
  icon: CodiconName;
  label: string;
  onClick: () => void;
}

interface FileChangeListProps {
  repo: Repository;
  changes: FileChange[];
  staged: boolean;
  title: string;
  count: number;
  viewMode: "tree" | "list";
  selectedKey: string | null;
  actions?: FileChangeListAction[];
  onSelect: (repo: Repository, change: FileChange, staged: boolean) => void;
  onStageToggle: (repo: Repository, change: FileChange, staged: boolean) => void;
  onDiscard: (repo: Repository, change: FileChange) => void;
  onContextMenu: (
    repo: Repository,
    change: FileChange,
    staged: boolean,
    position: { x: number; y: number }
  ) => void;
}

const ROW_HEIGHT = 22;
const VIRTUALIZE_THRESHOLD = 30;
const VIRTUALIZED_MAX_HEIGHT = 420; // ~19 rows, capped

export function FileChangeList({
  repo,
  changes,
  staged,
  title,
  count,
  viewMode,
  selectedKey,
  actions,
  onSelect,
  onStageToggle,
  onDiscard,
  onContextMenu
}: FileChangeListProps) {
  const [collapsed, setCollapsed] = useState(false);
  const shouldVirtualize = viewMode === "list" && changes.length > VIRTUALIZE_THRESHOLD;

  function rowKey(change: FileChange) {
    return `${staged ? "s" : "u"}:${change.path}`;
  }

  return (
    <section className="scm-section">
      <header className="scm-section__header">
        <button
          className="scm-section__toggle"
          onClick={() => setCollapsed((value) => !value)}
          type="button"
        >
          <Codicon name={collapsed ? "chevron-right" : "chevron-down"} size={14} />
          <span className="scm-section__title">{title}</span>
        </button>
        <div className="scm-section__actions">
          {actions?.map((action) => (
            <button
              key={action.label}
              className="scm-section__action"
              onClick={action.onClick}
              title={action.label}
              aria-label={action.label}
              type="button"
            >
              <Codicon name={action.icon} size={16} />
            </button>
          ))}
        </div>
        <span className="scm-section__count">{count}</span>
      </header>

      {!collapsed ? (
        shouldVirtualize ? (
          <VirtualizedRows
            repo={repo}
            changes={changes}
            staged={staged}
            selectedKey={selectedKey}
            rowKey={rowKey}
            onSelect={onSelect}
            onStageToggle={onStageToggle}
            onDiscard={onDiscard}
            onContextMenu={onContextMenu}
          />
        ) : (
          <div className="scm-section__body">
            {viewMode === "tree"
              ? renderTree(
                  changes,
                  rowKey,
                  selectedKey,
                  repo,
                  staged,
                  onSelect,
                  onStageToggle,
                  onDiscard,
                  onContextMenu
                )
              : changes.map((change) => (
                  <FileChangeRow
                    key={rowKey(change)}
                    repo={repo}
                    change={change}
                    staged={staged}
                    isSelected={selectedKey === rowKey(change)}
                    onSelect={onSelect}
                    onStageToggle={onStageToggle}
                    onDiscard={onDiscard}
                    onContextMenu={onContextMenu}
                  />
                ))}
          </div>
        )
      ) : null}
    </section>
  );
}

interface VirtualizedRowsProps {
  repo: Repository;
  changes: FileChange[];
  staged: boolean;
  selectedKey: string | null;
  rowKey: (change: FileChange) => string;
  onSelect: FileChangeListProps["onSelect"];
  onStageToggle: FileChangeListProps["onStageToggle"];
  onDiscard: FileChangeListProps["onDiscard"];
  onContextMenu: FileChangeListProps["onContextMenu"];
}

function VirtualizedRows({
  repo,
  changes,
  staged,
  selectedKey,
  rowKey,
  onSelect,
  onStageToggle,
  onDiscard,
  onContextMenu
}: VirtualizedRowsProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: changes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
    getItemKey: (index) => rowKey(changes[index]!)
  });

  const totalHeight = changes.length * ROW_HEIGHT;
  const containerHeight = Math.min(totalHeight, VIRTUALIZED_MAX_HEIGHT);

  return (
    <div
      className="scm-section__body scm-section__body--virtualized"
      ref={scrollRef}
      style={{ height: `${containerHeight}px` }}
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
        {virtualizer.getVirtualItems().map((item) => {
          const change = changes[item.index]!;
          return (
            <div
              key={item.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${item.start}px)`,
                height: `${item.size}px`
              }}
            >
              <FileChangeRow
                repo={repo}
                change={change}
                staged={staged}
                isSelected={selectedKey === rowKey(change)}
                onSelect={onSelect}
                onStageToggle={onStageToggle}
                onDiscard={onDiscard}
                onContextMenu={onContextMenu}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderTree(
  changes: FileChange[],
  rowKey: (change: FileChange) => string,
  selectedKey: string | null,
  repo: Repository,
  staged: boolean,
  onSelect: FileChangeListProps["onSelect"],
  onStageToggle: FileChangeListProps["onStageToggle"],
  onDiscard: FileChangeListProps["onDiscard"],
  onContextMenu: FileChangeListProps["onContextMenu"]
) {
  const grouped = changes.reduce<Record<string, FileChange[]>>((accumulator, change) => {
    const directory = change.path.includes("/")
      ? change.path.split("/").slice(0, -1).join("/")
      : ".";
    accumulator[directory] ??= [];
    accumulator[directory].push(change);
    return accumulator;
  }, {});

  return Object.entries(grouped).map(([directory, directoryChanges]) => (
    <div key={`${staged}-${directory}`}>
      <div className="scm-tree__directory">
        <Codicon name="chevron-down" size={12} />
        <Codicon name="folder" size={14} />
        <span>{directory}</span>
      </div>
      {directoryChanges.map((change) => (
        <FileChangeRow
          key={rowKey(change)}
          repo={repo}
          change={change}
          staged={staged}
          isSelected={selectedKey === rowKey(change)}
          indent={1}
          onSelect={onSelect}
          onStageToggle={onStageToggle}
          onDiscard={onDiscard}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  ));
}
