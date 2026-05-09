import type { DiffHunk as DiffHunkType } from "../../types/git";
import { DiffLine } from "./DiffLine";

interface DiffHunkProps {
  hunk: DiffHunkType;
  hunkIndex: number;
  isActive: boolean;
  mode: "split" | "inline";
  onFocus: () => void;
  selectedLineIndices: number[];
  onToggleLine: (hunkIndex: number, lineIndex: number) => void;
}

export function DiffHunk({
  hunk,
  hunkIndex,
  isActive,
  mode,
  onFocus,
  selectedLineIndices,
  onToggleLine
}: DiffHunkProps) {
  const oldLines = hunk.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.lineType !== "add");
  const newLines = hunk.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.lineType !== "remove");
  const selected = new Set(selectedLineIndices);

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
                  key={`old-${hunk.header}-${index}`}
                  line={line}
                  lineNumber={line.oldLineno}
                  onToggle={() => onToggleLine(hunkIndex, index)}
                  selectable={line.lineType !== "context"}
                  selected={selected.has(index)}
                />
              ))}
            </pre>
          </div>
          <div className="diff-column">
            <div className="diff-column__header">Modified</div>
            <pre className="diff-code">
              {newLines.map(({ line, index }) => (
                <DiffLine
                  key={`new-${hunk.header}-${index}`}
                  line={line}
                  lineNumber={line.newLineno}
                  onToggle={() => onToggleLine(hunkIndex, index)}
                  selectable={line.lineType !== "context"}
                  selected={selected.has(index)}
                />
              ))}
            </pre>
          </div>
        </div>
      ) : (
        <pre className="diff-code">
          {hunk.lines.map((line, index) => (
            <DiffLine
              key={`inline-${hunk.header}-${index}`}
              line={line}
              lineNumber={line.newLineno ?? line.oldLineno}
              onToggle={() => onToggleLine(hunkIndex, index)}
              selectable={line.lineType !== "context"}
              selected={selected.has(index)}
            />
          ))}
        </pre>
      )}
    </section>
  );
}
