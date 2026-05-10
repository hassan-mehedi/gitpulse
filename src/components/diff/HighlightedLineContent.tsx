import { useEffect, useState } from "react";
import { escapeHtml, highlightLine } from "../../lib/highlight";
import { useSettingsStore } from "../../stores/settings";

interface HighlightedLineContentProps {
  filePath: string;
  content: string;
}

export function HighlightedLineContent({
  filePath,
  content
}: HighlightedLineContentProps) {
  const theme = useSettingsStore((state) => state.theme);
  const [html, setHtml] = useState(() => escapeHtml(content));

  useEffect(() => {
    let cancelled = false;

    void highlightLine(filePath, content, theme)
      .then((nextHtml) => {
        if (!cancelled) {
          setHtml(nextHtml);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHtml(escapeHtml(content));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [content, filePath, theme]);

  return <span className="diff-line__content" dangerouslySetInnerHTML={{ __html: html }} />;
}
