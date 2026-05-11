import { useEffect, useState } from "react";
import { escapeHtml, highlightLine } from "../../lib/highlight";
import type { ThemeMode } from "../../lib/theme";

interface HighlightedLineContentProps {
  filePath: string;
  content: string;
  theme: ThemeMode;
}

export function HighlightedLineContent({
  filePath,
  content,
  theme
}: HighlightedLineContentProps) {
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
