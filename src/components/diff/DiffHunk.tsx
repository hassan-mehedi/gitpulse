import { useEffect, useMemo, useState } from "react";
import type { DiffHunk as DiffHunkType } from "../../types/git";
import type { ThemeMode } from "../../lib/theme";
import { highlightLines } from "../../lib/highlight";
import { DiffLine } from "./DiffLine";

interface DiffHunkProps {
  filePath: string;
  /** Repo path — forwarded to DiffLine for inline-blame on hover. */
  repoPath?: string;
  enableBlame?: boolean;
  hunk: DiffHunkType;
  hunkIndex: number;
  isActive: boolean;
  mode: "split" | "inline";
  theme: ThemeMode;
  enableHighlight?: boolean;
  onFocus: () => void;
  allowLineSelection?: boolean;
  selectedLineIndices: number[];
  onToggleLine: (hunkIndex: number, lineIndex: number) => void;
  onOpenLine?: (lineNumber: number) => void;
}

export function DiffHunk({
  filePath,
  repoPath,
  enableBlame = true,
  hunk,
  hunkIndex,
  isActive,
  mode,
  theme,
  enableHighlight = true,
  onFocus,
  allowLineSelection = true,
  selectedLineIndices,
  onToggleLine,
  onOpenLine
}: DiffHunkProps) {
  const oldLines = hunk.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.lineType !== "add");
  const newLines = hunk.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.lineType !== "remove");
  const selected = new Set(selectedLineIndices);
  const comparisons = useMemo(
    () => (enableHighlight ? buildLineComparisons(hunk.lines) : new Map<number, string>()),
    [enableHighlight, hunk.lines]
  );
  const [highlightedHtml, setHighlightedHtml] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setHighlightedHtml([]);
    if (!enableHighlight) {
      return () => {
        cancelled = true;
      };
    }
    const codes = hunk.lines.map((line) => line.content.slice(1));
    void highlightLines(filePath, codes, theme).then((next) => {
      if (!cancelled) setHighlightedHtml(next);
    });
    return () => {
      cancelled = true;
    };
  }, [enableHighlight, filePath, hunk.lines, theme]);

  return (
    <section className={`diff-hunk ${isActive ? "is-active" : ""}`} onMouseEnter={onFocus}>
      <div className="diff-hunk__header">
        <code>{hunk.header}</code>
      </div>
      {mode === "split" ? (
        <div className="diff-grid diff-grid--hunk">
          <div className="diff-column">
            <div className="diff-column__header">Original</div>
            <pre className="diff-code">
              {oldLines.map(({ line, index }) => (
                <DiffLine
                  filePath={filePath}
                  repoPath={repoPath}
                  enableBlame={enableBlame}
                  key={`old-${hunk.header}-${index}`}
                  line={line}
                  lineNumber={line.oldLineno}
                  onToggle={() => onToggleLine(hunkIndex, index)}
                  onOpenLine={onOpenLine}
                  selectable={allowLineSelection && line.lineType !== "context"}
                  selected={selected.has(index)}
                  theme={theme}
                  enableHighlight={enableHighlight}
                  compareContent={comparisons.get(index)}
                  highlightedHtml={highlightedHtml[index]}
                />
              ))}
            </pre>
          </div>
          <div className="diff-column">
            <div className="diff-column__header">Modified</div>
            <pre className="diff-code">
              {newLines.map(({ line, index }) => (
                <DiffLine
                  filePath={filePath}
                  repoPath={repoPath}
                  enableBlame={enableBlame}
                  key={`new-${hunk.header}-${index}`}
                  line={line}
                  lineNumber={line.newLineno}
                  onToggle={() => onToggleLine(hunkIndex, index)}
                  onOpenLine={onOpenLine}
                  selectable={allowLineSelection && line.lineType !== "context"}
                  selected={selected.has(index)}
                  theme={theme}
                  enableHighlight={enableHighlight}
                  compareContent={comparisons.get(index)}
                  highlightedHtml={highlightedHtml[index]}
                />
              ))}
            </pre>
          </div>
        </div>
      ) : (
        <pre className="diff-code">
          {hunk.lines.map((line, index) => (
            <DiffLine
              filePath={filePath}
              repoPath={repoPath}
              enableBlame={enableBlame}
              key={`inline-${hunk.header}-${index}`}
              line={line}
              lineNumber={line.newLineno ?? line.oldLineno}
              onToggle={() => onToggleLine(hunkIndex, index)}
              onOpenLine={onOpenLine}
              selectable={allowLineSelection && line.lineType !== "context"}
              selected={selected.has(index)}
              theme={theme}
              enableHighlight={enableHighlight}
              compareContent={comparisons.get(index)}
              highlightedHtml={highlightedHtml[index]}
            />
          ))}
        </pre>
      )}
    </section>
  );
}

function buildLineComparisons(lines: DiffHunkType["lines"]) {
  const comparisons = new Map<number, string>();
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line || line.lineType === "context") continue;
    const code = line.content.slice(1);
    if (line.lineType === "remove") {
      const next = lines[index + 1];
      if (next?.lineType === "add") comparisons.set(index, next.content.slice(1));
    } else if (line.lineType === "add") {
      const prev = lines[index - 1];
      if (prev?.lineType === "remove") comparisons.set(index, prev.content.slice(1));
    }
    if (comparisons.get(index) === code) {
      comparisons.delete(index);
    }
  }
  return comparisons;
}
