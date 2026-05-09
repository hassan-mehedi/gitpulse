import { ChevronDown, ChevronUp } from "lucide-react";

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
      <button className="icon-button" disabled={total === 0} onClick={onPrevious} type="button">
        <ChevronUp size={14} />
      </button>
      <div className="badge">
        Hunk {Math.min(activeIndex + 1, Math.max(total, 1))}/{total}
      </div>
      <button className="icon-button" disabled={total === 0} onClick={onNext} type="button">
        <ChevronDown size={14} />
      </button>
    </div>
  );
}
