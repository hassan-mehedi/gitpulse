import { memo, useEffect, useState } from "react";
import { Icon, addCollection } from "@iconify/react";
import { getIconForFile } from "vscode-icons-js";
import { Codicon } from "./Codicon";

let collectionLoaded = false;
let collectionLoading: Promise<void> | null = null;

function ensureCollection(): Promise<void> {
  if (collectionLoaded) return Promise.resolve();
  if (collectionLoading) return collectionLoading;
  collectionLoading = import("@iconify-json/vscode-icons/icons.json")
    .then((mod) => {
      addCollection(mod.default ?? (mod as unknown as Parameters<typeof addCollection>[0]));
      collectionLoaded = true;
    })
    .catch(() => {});
  return collectionLoading;
}

function svgFilenameToIconName(filename: string | undefined) {
  if (!filename) return null;
  return filename.replace(/\.svg$/, "").replace(/_/g, "-");
}

interface FileIconProps {
  path: string;
  size?: number;
  className?: string;
}

function FileIconImpl({ path, size = 16, className }: FileIconProps) {
  const [ready, setReady] = useState(collectionLoaded);

  useEffect(() => {
    if (collectionLoaded) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void ensureCollection().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const basename = path.split("/").pop() ?? path;
  const iconName = svgFilenameToIconName(getIconForFile(basename));

  if (!ready || !iconName) {
    return <Codicon name="file" size={size} className={className} />;
  }

  return (
    <Icon
      icon={`vscode-icons:${iconName}`}
      width={size}
      height={size}
      className={className}
      style={{ flex: "0 0 auto", display: "inline-block" }}
    />
  );
}

export const FileIcon = memo(FileIconImpl);
