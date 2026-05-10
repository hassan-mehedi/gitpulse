import type { BlameLine } from "../../types/git";

interface BlameTooltipProps {
  line: BlameLine;
}

export function BlameTooltip({ line }: BlameTooltipProps) {
  return (
    <div className="blame-tooltip">
      <div className="blame-tooltip__title">{line.summary}</div>
      <div className="blame-tooltip__meta">{line.author}</div>
      <div className="blame-tooltip__meta">{line.authorEmail}</div>
      <div className="blame-tooltip__meta">{line.date}</div>
      <div className="blame-tooltip__meta">{line.sha}</div>
    </div>
  );
}
