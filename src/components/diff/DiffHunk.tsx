import type { DiffHunk as DiffHunkType } from "../../types/git";
import type { ThemeMode } from "../../lib/theme";
import { DiffLine } from "./DiffLine";

interface DiffHunkProps {
  filePath: string;
  hunk: DiffHunkType;
  hunkIndex: number;
  isActive: boolean;
  mode: "split" | "inline";
  theme: ThemeMode;
  onFocus: () => void;
  selectedLineIndices: number[];
  onToggleLine: (hunkIndex: number, lineIndex: number) => void;
}

export function DiffHunk({
  filePath,
  hunk,
  hunkIndex,
  isActive,
  mode,
  theme,
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
                  filePath={filePath}
                  key={`old-${hunk.header}-${index}`}
                  line={line}
                  lineNumber={line.oldLineno}
                  onToggle={() => onToggleLine(hunkIndex, index)}
                  selectable={line.lineType !== "context"}
                  selected={selected.has(index)}
                  theme={theme}
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
                  key={`new-${hunk.header}-${index}`}
                  line={line}
                  lineNumber={line.newLineno}
                  onToggle={() => onToggleLine(hunkIndex, index)}
                  selectable={line.lineType !== "context"}
                  selected={selected.has(index)}
                  theme={theme}
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
              key={`inline-${hunk.header}-${index}`}
              line={line}
              lineNumber={line.newLineno ?? line.oldLineno}
              onToggle={() => onToggleLine(hunkIndex, index)}
              selectable={line.lineType !== "context"}
              selected={selected.has(index)}
              theme={theme}
            />
          ))}
        </pre>
      )}
    </section>
  );
}
