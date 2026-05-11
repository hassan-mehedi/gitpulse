import { Codicon } from "../shared/Codicon";

interface DiffNavigationProps {
  activeIndex: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}

export function DiffNavigation({
  activeIndex,
  total,
  onPrevious,
  onNext
}: DiffNavigationProps) {
  return (
    <div className="diff-navigation">
      <button className="view-action" disabled={total === 0} onClick={onPrevious} title="Previous Hunk" type="button">
        <Codicon name="chevron-up" size={14} />
      </button>
      <span className="diff-viewer__hunk-counter">
        Hunk {Math.min(activeIndex + 1, Math.max(total, 1))}/{total}
      </span>
      <button className="view-action" disabled={total === 0} onClick={onNext} title="Next Hunk" type="button">
        <Codicon name="chevron-down" size={14} />
      </button>
    </div>
  );
}
