import type { CSSProperties, HTMLAttributes } from "react";

export type CodiconName =
  | "source-control"
  | "git-branch"
  | "git-commit"
  | "git-merge"
  | "git-pull-request"
  | "git-pull-request-go-to-changes"
  | "git-cherry-pick"
  | "history"
  | "search"
  | "settings-gear"
  | "account"
  | "bell"
  | "bell-dot"
  | "refresh"
  | "sync"
  | "sync~spin"
  | "check"
  | "list-tree"
  | "list-flat"
  | "ellipsis"
  | "go-to-file"
  | "discard"
  | "add"
  | "plus"
  | "remove"
  | "trash"
  | "edit"
  | "diff-single"
  | "diff"
  | "repo"
  | "repo-clone"
  | "repo-pull"
  | "repo-push"
  | "repo-fetch"
  | "repo-forked"
  | "references"
  | "folder-opened"
  | "folder"
  | "archive"
  | "tag"
  | "arrow-up"
  | "arrow-down"
  | "arrow-left"
  | "arrow-right"
  | "arrow-both"
  | "chevron-right"
  | "chevron-down"
  | "chevron-left"
  | "chevron-up"
  | "collapse-all"
  | "expand-all"
  | "copy"
  | "split-horizontal"
  | "close"
  | "warning"
  | "error"
  | "info"
  | "eye"
  | "eye-closed"
  | "filter"
  | "play"
  | "rocket"
  | "remote"
  | "circle-slash"
  | "file"
  | "file-code"
  | "calendar"
  | "verified"
  | "whitespace"
  | "tools";

interface CodiconProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  name: CodiconName;
  size?: number;
  spin?: boolean;
  title?: string;
}

export function Codicon({
  name,
  size,
  spin,
  className,
  style,
  title,
  ...rest
}: CodiconProps) {
  const finalClass = [
    "codicon",
    `codicon-${spin ? `${name}~spin` : name}`,
    className
  ]
    .filter(Boolean)
    .join(" ");

  const finalStyle: CSSProperties | undefined =
    typeof size === "number"
      ? { fontSize: `${size}px`, lineHeight: 1, ...style }
      : style;

  return (
    <i
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      className={finalClass}
      style={finalStyle}
      {...rest}
    />
  );
}
