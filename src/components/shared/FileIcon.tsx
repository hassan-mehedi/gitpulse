import { memo, useState } from "react";
import { getIconForFile } from "vscode-icons-js";
import { Codicon } from "./Codicon";

interface FileIconProps {
  path: string;
  size?: number;
  className?: string;
}

// Pinned vscode-icons release. Bump deliberately when upstream ships new glyphs.
const ICON_BASE =
  "https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons@12.13.0/icons";

/**
 * Per-language file icon, source: vscode-icons (extension data via vscode-icons-js +
 * SVG assets via jsdelivr CDN). Falls back to a generic codicon-file glyph if the
 * load fails (offline, CDN blocked, unknown basename).
 *
 * Future work: bundle the SVGs locally for offline support — see TRACKING.md task #104.
 */
function FileIconImpl({ path, size = 16, className }: FileIconProps) {
  const [failed, setFailed] = useState(false);
  const basename = path.split("/").pop() ?? path;
  const iconName = getIconForFile(basename);

  if (failed || !iconName) {
    return <Codicon name="file" size={size} className={className} />;
  }

  return (
    <img
      alt=""
      aria-hidden
      className={className}
      height={size}
      onError={() => setFailed(true)}
      src={`${ICON_BASE}/${iconName}`}
      style={{ flex: "0 0 auto", display: "inline-block" }}
      width={size}
    />
  );
}

export const FileIcon = memo(FileIconImpl);
