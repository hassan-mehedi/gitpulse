import { memo, useState } from "react";
import { Codicon } from "../shared/Codicon";
import { FileIcon } from "../shared/FileIcon";
import { useDiffStore } from "../../stores/diff";
import type { ActivityView } from "../../types/git";

const DRAG_TYPE = "application/x-gitpulse-tab";

interface TabStripProps {
  scope?: Extract<ActivityView, "source-control" | "graph">;
  repoPath?: string;
}

export const TabStrip = memo(function TabStrip({ scope, repoPath }: TabStripProps) {
  const tabs = useDiffStore((state) => state.tabs);
  const activeTabKey = useDiffStore((state) => state.activeTabKey);
  const selectTab = useDiffStore((state) => state.selectTab);
  const closeTab = useDiffStore((state) => state.closeTab);
  const pinActiveTab = useDiffStore((state) => state.pinActiveTab);
  const reorderTab = useDiffStore((state) => state.reorderTab);

  const [dragKey, setDragKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [hoverSide, setHoverSide] = useState<"before" | "after">("before");
  const visibleTabs = tabs.filter((tab) => {
    if (scope && tab.scope !== scope) {
      return false;
    }
    if (repoPath && tab.repo.path !== repoPath) {
      return false;
    }
    return true;
  });

  if (visibleTabs.length === 0) {
    return null;
  }

  return (
    <div className="tab-strip" role="tablist">
      {visibleTabs.map((tab) => {
        const name = tab.filePath.split("/").pop() ?? tab.filePath;
        const isActive = tab.key === activeTabKey;
        const isHover = hoverKey === tab.key && dragKey !== null && dragKey !== tab.key;
        return (
          <div
            key={tab.key}
            className={[
              "tab",
              isActive ? "is-active" : "",
              tab.preview ? "is-preview" : "",
              dragKey === tab.key ? "is-dragging" : "",
              isHover && hoverSide === "before" ? "is-drop-before" : "",
              isHover && hoverSide === "after" ? "is-drop-after" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            role="tab"
            aria-selected={isActive}
            draggable
            onDragStart={(event) => {
              setDragKey(tab.key);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(DRAG_TYPE, tab.key);
            }}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              const rect = event.currentTarget.getBoundingClientRect();
              const midpoint = rect.left + rect.width / 2;
              setHoverKey(tab.key);
              setHoverSide(event.clientX < midpoint ? "before" : "after");
            }}
            onDragLeave={() => {
              if (hoverKey === tab.key) {
                setHoverKey(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              const fromKey = event.dataTransfer.getData(DRAG_TYPE);
              if (fromKey && fromKey !== tab.key) {
                reorderTab(fromKey, tab.key, hoverSide);
              }
              setDragKey(null);
              setHoverKey(null);
            }}
            onDragEnd={() => {
              setDragKey(null);
              setHoverKey(null);
            }}
            onClick={() => void selectTab(tab.key)}
            onDoubleClick={() => {
              pinActiveTab();
            }}
            onAuxClick={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                void closeTab(tab.key);
              }
            }}
            title={
              tab.kind === "commit"
                ? `${tab.filePath} (${tab.commit.shortSha})`
                : tab.filePath
            }
          >
            <FileIcon path={tab.filePath} size={16} className="tab__icon" />
            <span className="tab__name">{name}</span>
            {tab.staged ? (
              <span className="tab__badge">staged</span>
            ) : null}
            <button
              className="tab__close"
              onClick={(event) => {
                event.stopPropagation();
                void closeTab(tab.key);
              }}
              title="Close (Middle-click)"
              aria-label="Close"
              type="button"
            >
              <Codicon name="close" size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
});
