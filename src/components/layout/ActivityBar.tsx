import { GitBranch, GitCommitHorizontal, GitGraph, Settings2, SplitSquareVertical } from "lucide-react";
import type { ActivityView } from "../../types/git";

const items: Array<{ key: ActivityView; label: string; icon: typeof SplitSquareVertical }> = [
  { key: "source-control", label: "SCM", icon: SplitSquareVertical },
  { key: "branches", label: "Branches", icon: GitBranch },
  { key: "graph", label: "Graph", icon: GitGraph },
  { key: "blame", label: "Blame", icon: GitCommitHorizontal },
  { key: "settings", label: "Config", icon: Settings2 }
];

interface ActivityBarProps {
  activeView: ActivityView;
  onNavigate: (view: ActivityView) => void;
}

export function ActivityBar({ activeView, onNavigate }: ActivityBarProps) {
  return (
    <aside className="activity-bar">
      <div className="activity-bar__stack">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              className={`activity-bar__item ${activeView === item.key ? "is-active" : ""}`}
              onClick={() => onNavigate(item.key)}
              type="button"
            >
              <Icon size={18} />
              <span className="activity-bar__label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
