import { memo } from "react";
import type { DiffLine as DiffLineType } from "../../types/git";
import type { ThemeMode } from "../../lib/theme";
import { HighlightedLineContent } from "./HighlightedLineContent";

interface DiffLineProps {
  filePath: string;
  line: DiffLineType;
  lineNumber?: number;
  selected?: boolean;
  selectable?: boolean;
  theme: ThemeMode;
  onToggle?: () => void;
}

function DiffLineImpl({
  filePath,
  line,
  lineNumber,
  selected,
  selectable,
  theme,
  onToggle
}: DiffLineProps) {
  const marker = line.content.slice(0, 1);
  const code = line.content.slice(1);

  return (
    <button
      className={`diff-line diff-line--${line.lineType} ${selected ? "is-selected" : ""} ${selectable ? "is-selectable" : ""}`}
      onClick={onToggle}
      type="button"
    >
      <span className="diff-line__number">{lineNumber ?? ""}</span>
      <span className="diff-line__content-wrap">
        <span className="diff-line__marker">{marker}</span>
        <HighlightedLineContent content={code} filePath={filePath} theme={theme} />
      </span>
    </button>
  );
}

export const DiffLine = memo(DiffLineImpl);
