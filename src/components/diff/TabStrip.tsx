import { memo } from "react";
import { Codicon } from "../shared/Codicon";
import { FileIcon } from "../shared/FileIcon";
import { useDiffStore } from "../../stores/diff";

export const TabStrip = memo(function TabStrip() {
  const tabs = useDiffStore((state) => state.tabs);
  const activeTabKey = useDiffStore((state) => state.activeTabKey);
  const selectTab = useDiffStore((state) => state.selectTab);
  const closeTab = useDiffStore((state) => state.closeTab);
  const pinActiveTab = useDiffStore((state) => state.pinActiveTab);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="tab-strip" role="tablist">
      {tabs.map((tab) => {
        const name = tab.change.path.split("/").pop() ?? tab.change.path;
        const isActive = tab.key === activeTabKey;
        return (
          <div
            key={tab.key}
            className={`tab${isActive ? " is-active" : ""}${tab.preview ? " is-preview" : ""}`}
            role="tab"
            aria-selected={isActive}
            onClick={() => void selectTab(tab.key)}
            onDoubleClick={() => {
              pinActiveTab();
            }}
            onAuxClick={(event) => {
              // Middle-click closes tab (matches VS Code).
              if (event.button === 1) {
                event.preventDefault();
                void closeTab(tab.key);
              }
            }}
            title={tab.change.path}
          >
            <FileIcon path={tab.change.path} size={16} className="tab__icon" />
            <span className="tab__name">{name}</span>
            {tab.staged ? <span className="tab__badge">staged</span> : null}
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
