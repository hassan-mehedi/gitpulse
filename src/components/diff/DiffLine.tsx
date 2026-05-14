import { memo } from "react";
import type { DiffLine as DiffLineType } from "../../types/git";
import type { ThemeMode } from "../../lib/theme";
import { useInlineBlameStore } from "../../stores/inlineBlame";
import { HighlightedLineContent } from "./HighlightedLineContent";

interface DiffLineProps {
  filePath: string;
  /** Repo path — needed to fetch inline blame for the hovered line. */
  repoPath?: string;
  enableBlame?: boolean;
  line: DiffLineType;
  lineNumber?: number;
  selected?: boolean;
  selectable?: boolean;
  theme: ThemeMode;
  compareContent?: string;
  onToggle?: () => void;
}

function DiffLineImpl({
  filePath,
  repoPath,
  enableBlame = true,
  line,
  lineNumber,
  selected,
  selectable,
  theme,
  compareContent,
  onToggle
}: DiffLineProps) {
  const setBlameTarget = useInlineBlameStore((state) => state.setTarget);
  const marker = line.content.slice(0, 1);
  const code = line.content.slice(1);

  // Pick the original-side line number when present (the line as it exists in
  // the committed tree), falling back to the new line for additions.
  const blameLine = line.oldLineno ?? line.newLineno ?? lineNumber;

  function handleEnter() {
    if (!enableBlame || !repoPath || !blameLine) return;
    setBlameTarget({ repoPath, file: filePath, line: blameLine });
  }

  return (
    <button
      className={`diff-line diff-line--${line.lineType} ${selected ? "is-selected" : ""} ${selectable ? "is-selectable" : ""}`}
      onClick={onToggle}
      onMouseEnter={handleEnter}
      data-diff-line={lineNumber ? `${filePath}:${lineNumber}` : undefined}
      type="button"
    >
      <span className="diff-line__number">{lineNumber ?? ""}</span>
      <span className="diff-line__content-wrap">
        <span className="diff-line__marker">{marker}</span>
        {compareContent !== undefined ? (
          <WordHighlightedContent content={code} compareContent={compareContent} />
        ) : (
          <HighlightedLineContent content={code} filePath={filePath} theme={theme} />
        )}
      </span>
    </button>
  );
}

export const DiffLine = memo(DiffLineImpl);

function WordHighlightedContent({
  content,
  compareContent
}: {
  content: string;
  compareContent: string;
}) {
  const { start, end } = changedRange(content, compareContent);
  if (start >= end) {
    return <span className="diff-line__content">{content}</span>;
  }
  return (
    <span className="diff-line__content">
      {content.slice(0, start)}
      <span className="diff-line__word-highlight">{content.slice(start, end)}</span>
      {content.slice(end)}
    </span>
  );
}

function changedRange(value: string, compare: string) {
  let start = 0;
  while (start < value.length && start < compare.length && value[start] === compare[start]) {
    start++;
  }
  let valueEnd = value.length;
  let compareEnd = compare.length;
  while (valueEnd > start && compareEnd > start && value[valueEnd - 1] === compare[compareEnd - 1]) {
    valueEnd--;
    compareEnd--;
  }
  return { start, end: valueEnd };
}
