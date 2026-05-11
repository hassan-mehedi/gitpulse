import { memo, useMemo, useState, type ReactNode } from "react";
import { Codicon } from "./Codicon";
import { FileIcon } from "./FileIcon";

/**
 * A file's place in the tree. Consumers pass a flat array of these and the
 * tree builds the nested directory structure from `path` for them.
 */
export interface FileTreeEntry<T = unknown> {
  /** Full forward-slash-separated path used both as identity and for nesting. */
  path: string;
  /** Optional pre-split segments. Computed from `path` when absent. */
  segments?: string[];
  /** The original payload — passed back to `renderFile`. */
  data: T;
}

interface FileTreeProps<T> {
  entries: FileTreeEntry<T>[];
  /** Directories collapsed by default? Default false (show everything). */
  defaultCollapsed?: boolean;
  /** Optional render for the leaf (file) row's content. */
  renderFile: (entry: FileTreeEntry<T>) => ReactNode;
  /** True for the entry that should appear selected. */
  isSelected?: (entry: FileTreeEntry<T>) => boolean;
  /**
   * Optional namespace for persisting collapse state across remounts. When
   * provided, each directory's collapsed/expanded state is keyed by
   * `gitpulse:tree:<storageKey>:<fullPath>` in localStorage.
   */
  storageKey?: string;
}

interface Node<T> {
  name: string;
  /** Full segment path joined with `/`, including this node. */
  fullPath: string;
  /** Set when this node is a directory (children may be empty). */
  children: Node<T>[];
  /** Set when this node is a leaf. */
  file?: FileTreeEntry<T>;
}

function buildTree<T>(entries: FileTreeEntry<T>[]): Node<T> {
  const root: Node<T> = { name: "", fullPath: "", children: [] };

  for (const entry of entries) {
    const segments = entry.segments ?? entry.path.split("/");
    let cursor = root;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const isLeaf = i === segments.length - 1;
      const fullPath = segments.slice(0, i + 1).join("/");

      let child = cursor.children.find((node) => node.name === segment);
      if (!child) {
        child = { name: segment, fullPath, children: [] };
        cursor.children.push(child);
      }
      if (isLeaf) {
        child.file = entry;
      }
      cursor = child;
    }
  }

  // Compact chains: if a directory has exactly one directory child and no file,
  // collapse them into one (`src/components` instead of `src` > `components`).
  // Matches the VS Code "Compact Folders" default.
  function compact(node: Node<T>): Node<T> {
    while (
      !node.file &&
      node.children.length === 1 &&
      !node.children[0]!.file &&
      node.children[0]!.children.length > 0
    ) {
      const only = node.children[0]!;
      node.name = node.name ? `${node.name}/${only.name}` : only.name;
      node.fullPath = only.fullPath;
      node.children = only.children;
    }
    node.children.forEach((child) => compact(child));
    return node;
  }

  return compact(root);
}

function sortNodes<T>(node: Node<T>): void {
  node.children.sort((a, b) => {
    const aDir = a.file === undefined;
    const bDir = b.file === undefined;
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  node.children.forEach((child) => sortNodes(child));
}

function loadCollapsed(storageKey: string, fullPath: string): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(
      `gitpulse:tree:${storageKey}:${fullPath}`
    );
    if (value === "1") return true;
    if (value === "0") return false;
    return null;
  } catch {
    return null;
  }
}

function persistCollapsed(storageKey: string, fullPath: string, collapsed: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `gitpulse:tree:${storageKey}:${fullPath}`,
      collapsed ? "1" : "0"
    );
  } catch {
    // localStorage may be unavailable; silent.
  }
}

function FileTreeImpl<T>({
  entries,
  defaultCollapsed = false,
  renderFile,
  isSelected,
  storageKey
}: FileTreeProps<T>) {
  const root = useMemo(() => {
    const built = buildTree(entries);
    sortNodes(built);
    return built;
  }, [entries]);

  return (
    <div className="file-tree">
      {root.children.map((node) => (
        <TreeNode
          key={node.fullPath}
          node={node}
          depth={0}
          defaultCollapsed={defaultCollapsed}
          renderFile={renderFile}
          isSelected={isSelected}
          storageKey={storageKey}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps<T> {
  node: Node<T>;
  depth: number;
  defaultCollapsed: boolean;
  renderFile: (entry: FileTreeEntry<T>) => ReactNode;
  isSelected?: (entry: FileTreeEntry<T>) => boolean;
  storageKey?: string;
}

function TreeNode<T>({
  node,
  depth,
  defaultCollapsed,
  renderFile,
  isSelected,
  storageKey
}: TreeNodeProps<T>) {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (storageKey) {
      const stored = loadCollapsed(storageKey, node.fullPath);
      if (stored !== null) return stored;
    }
    return defaultCollapsed;
  });

  function setCollapsed(next: boolean) {
    setCollapsedState(next);
    if (storageKey) {
      persistCollapsed(storageKey, node.fullPath, next);
    }
  }

  if (node.file) {
    return (
      <div
        className={`file-tree__leaf${isSelected?.(node.file) ? " is-selected" : ""}`}
        style={{ paddingLeft: indentPx(depth) }}
      >
        {renderFile(node.file)}
      </div>
    );
  }

  return (
    <div className="file-tree__group">
      <button
        className="file-tree__directory"
        onClick={() => setCollapsed(!collapsed)}
        style={{ paddingLeft: indentPx(depth) }}
        type="button"
      >
        <Codicon
          name={collapsed ? "chevron-right" : "chevron-down"}
          size={14}
          className="file-tree__chevron"
        />
        <Codicon
          name={collapsed ? "folder" : "folder-opened"}
          size={14}
          className="file-tree__folder-icon"
        />
        <span className="file-tree__directory-name">{node.name}</span>
      </button>
      {!collapsed
        ? node.children.map((child) => (
            <TreeNode
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              defaultCollapsed={defaultCollapsed}
              renderFile={renderFile}
              isSelected={isSelected}
              storageKey={storageKey}
            />
          ))
        : null}
    </div>
  );
}

function indentPx(depth: number) {
  return `${8 + depth * 12}px`;
}

export const FileTree = memo(FileTreeImpl) as typeof FileTreeImpl;

/** Convenience helper for renderers that want a path → segments split. */
export function splitPath(path: string): string[] {
  return path.split("/").filter(Boolean);
}
