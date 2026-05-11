import { memo } from "react";
import type { BlameLine } from "../../types/git";
import { BlameTooltip } from "./BlameTooltip";

interface BlameAnnotationProps {
  line: BlameLine;
  isSelected: boolean;
  /** True when the previous line shares the same SHA — meta is hidden, only a
   *  thin colored bar shows visual grouping. */
  isGrouped: boolean;
  onSelect: () => void;
}

function relativeTime(unixTimestamp: string): string {
  const seconds = Number(unixTimestamp);
  if (!Number.isFinite(seconds) || seconds === 0) return unixTimestamp;
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86_400 * 30) return `${Math.floor(diff / 86_400)}d ago`;
  if (diff < 86_400 * 365) return `${Math.floor(diff / (86_400 * 30))}mo ago`;
  return `${Math.floor(diff / (86_400 * 365))}y ago`;
}

function BlameAnnotationImpl({
  line,
  isSelected,
  isGrouped,
  onSelect
}: BlameAnnotationProps) {
  return (
    <button
      className={`blame-row${isSelected ? " is-active" : ""}${isGrouped ? " is-grouped" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <div className="blame-row__meta">
        {isGrouped ? null : (
          <>
            <span className="blame-row__author">{line.author || "Unknown"}</span>
            <span className="blame-row__summary">{line.summary || line.sha.slice(0, 7)}</span>
            <span className="blame-row__date">{relativeTime(line.date)}</span>
          </>
        )}
      </div>
      <div className="blame-row__code">
        <span className="blame-row__line-number">{line.lineNumber}</span>
        <span className="blame-row__content">{line.content}</span>
      </div>
      <BlameTooltip line={line} />
    </button>
  );
}

export const BlameAnnotation = memo(BlameAnnotationImpl);
