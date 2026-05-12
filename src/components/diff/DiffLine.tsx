import { memo } from "react";
import type { DiffLine as DiffLineType } from "../../types/git";
import type { ThemeMode } from "../../lib/theme";
import { useInlineBlameStore } from "../../stores/inlineBlame";
import { HighlightedLineContent } from "./HighlightedLineContent";

interface DiffLineProps {
  filePath: string;
  /** Repo path — needed to fetch inline blame for the hovered line. */
  repoPath?: string;
  line: DiffLineType;
  lineNumber?: number;
  selected?: boolean;
  selectable?: boolean;
  theme: ThemeMode;
  onToggle?: () => void;
}

function DiffLineImpl({
  filePath,
  repoPath,
  line,
  lineNumber,
  selected,
  selectable,
  theme,
  onToggle
}: DiffLineProps) {
  const setBlameTarget = useInlineBlameStore((state) => state.setTarget);
  const marker = line.content.slice(0, 1);
  const code = line.content.slice(1);

  // Pick the original-side line number when present (the line as it exists in
  // the committed tree), falling back to the new line for additions.
  const blameLine = line.oldLineno ?? line.newLineno ?? lineNumber;

  function handleEnter() {
    if (!repoPath || !blameLine) return;
    setBlameTarget({ repoPath, file: filePath, line: blameLine });
  }

  return (
    <button
      className={`diff-line diff-line--${line.lineType} ${selected ? "is-selected" : ""} ${selectable ? "is-selectable" : ""}`}
      onClick={onToggle}
      onMouseEnter={handleEnter}
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
