import { memo } from "react";
import { Codicon } from "./Codicon";

interface FileIconProps {
  path: string;
  size?: number;
  className?: string;
}

const CODE_EXTENSIONS = new Set([
  "c",
  "cc",
  "cpp",
  "cs",
  "css",
  "go",
  "h",
  "hpp",
  "html",
  "java",
  "js",
  "jsx",
  "kt",
  "lua",
  "php",
  "py",
  "rb",
  "rs",
  "sass",
  "scss",
  "sh",
  "sql",
  "swift",
  "ts",
  "tsx",
  "vue"
]);

const CONFIG_EXTENSIONS = new Set(["env", "ini", "json", "lock", "toml", "yaml", "yml"]);
const DOC_EXTENSIONS = new Set(["adoc", "md", "mdx", "rst", "txt"]);
const ARCHIVE_EXTENSIONS = new Set(["7z", "bz2", "gz", "rar", "tar", "tgz", "zip"]);

const SPECIAL_NAMES: Record<string, FileIconTone> = {
  dockerfile: "container",
  makefile: "config",
  "package.json": "package",
  "package-lock.json": "package",
  "pnpm-lock.yaml": "package",
  "yarn.lock": "package",
  "cargo.toml": "package",
  "cargo.lock": "package"
};

type FileIconTone = "archive" | "code" | "config" | "container" | "doc" | "file" | "package";

function getIconTone(path: string): FileIconTone {
  const basename = path.split("/").pop()?.toLowerCase() ?? path.toLowerCase();
  const special = SPECIAL_NAMES[basename];
  if (special) return special;

  const extension = basename.includes(".") ? basename.split(".").pop() ?? "" : "";
  if (CODE_EXTENSIONS.has(extension)) return "code";
  if (CONFIG_EXTENSIONS.has(extension)) return "config";
  if (DOC_EXTENSIONS.has(extension)) return "doc";
  if (ARCHIVE_EXTENSIONS.has(extension)) return "archive";
  return "file";
}

function FileIconImpl({ path, size = 16, className }: FileIconProps) {
  const tone = getIconTone(path);
  const iconName = tone === "archive" ? "archive" : tone === "file" ? "file" : "file-code";
  const finalClassName = ["file-icon", `file-icon--${tone}`, className].filter(Boolean).join(" ");

  return <Codicon name={iconName} size={size} className={finalClassName} />;
}

export const FileIcon = memo(FileIconImpl);
