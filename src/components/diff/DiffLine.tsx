import type { DiffLine as DiffLineType } from "../../types/git";

interface DiffLineProps {
  line: DiffLineType;
  lineNumber?: number;
  selected?: boolean;
  selectable?: boolean;
  onToggle?: () => void;
}

export function DiffLine({ line, lineNumber, selected, selectable, onToggle }: DiffLineProps) {
  return (
    <button
      className={`diff-line diff-line--${line.lineType} ${selected ? "is-selected" : ""} ${selectable ? "is-selectable" : ""}`}
      onClick={onToggle}
      type="button"
    >
      <span className="diff-line__number">{lineNumber ?? ""}</span>
      <span className="diff-line__content">{line.content}</span>
    </button>
  );
}
