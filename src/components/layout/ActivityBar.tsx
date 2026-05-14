import { Codicon, type CodiconName } from "../shared/Codicon";
import { useWorkspaceStore } from "../../stores/workspace";
import type { ActivityView } from "../../types/git";

interface Item {
  key: ActivityView;
  icon: CodiconName;
  label: string;
  position: "top" | "bottom";
  badgeFrom?: "scm-changes";
}

const items: Item[] = [
  { key: "source-control", icon: "source-control", label: "Source Control", position: "top", badgeFrom: "scm-changes" },
  { key: "branches", icon: "repo-forked", label: "Branches", position: "top" },
  { key: "graph", icon: "git-commit", label: "Commit Graph", position: "top" },
  { key: "misc", icon: "tools", label: "Advanced Git", position: "top" },
  { key: "settings", icon: "settings-gear", label: "Settings", position: "bottom" }
];

interface ActivityBarProps {
  activeView: ActivityView;
  onNavigate: (view: ActivityView) => void;
}

export function ActivityBar({ activeView, onNavigate }: ActivityBarProps) {
  const repositories = useWorkspaceStore((state) => state.repositories);
  const totalChanges = repositories.reduce(
    (sum, repo) => sum + repo.changes.length + repo.staged.length,
    0
  );

  function renderItem(item: Item) {
    const isActive = activeView === item.key;
    const badgeCount = item.badgeFrom === "scm-changes" ? totalChanges : 0;

    return (
      <button
        key={item.key}
        className={`activity-bar__item${isActive ? " is-active" : ""}`}
        onClick={() => onNavigate(item.key)}
        title={item.label}
        aria-label={item.label}
        aria-pressed={isActive}
        type="button"
      >
        <Codicon name={item.icon} size={24} />
        {badgeCount > 0 ? (
          <span className="activity-bar__badge">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </button>
    );
  }

  const top = items.filter((item) => item.position === "top");
  const bottom = items.filter((item) => item.position === "bottom");

  return (
    <nav className="activity-bar" aria-label="Primary">
      <div className="activity-bar__group">{top.map(renderItem)}</div>
      <div className="activity-bar__group activity-bar__group--bottom">{bottom.map(renderItem)}</div>
    </nav>
  );
}
