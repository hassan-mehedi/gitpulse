import type { BlameLine } from "../../types/git";
import { BlameTooltip } from "./BlameTooltip";

interface BlameAnnotationProps {
  line: BlameLine;
  isSelected: boolean;
  onSelect: () => void;
}

export function BlameAnnotation({ line, isSelected, onSelect }: BlameAnnotationProps) {
  return (
    <button
      className={`blame-row ${isSelected ? "is-active" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <div className="blame-row__meta">
        <div className="blame-row__author">{line.author}</div>
        <div className="blame-row__summary">{line.summary}</div>
        <div className="blame-row__date">{line.date}</div>
      </div>
      <div className="blame-row__code">
        <span className="blame-row__line-number">{line.lineNumber}</span>
        <span className="blame-row__content">{line.content}</span>
      </div>
      <BlameTooltip line={line} />
    </button>
  );
}
