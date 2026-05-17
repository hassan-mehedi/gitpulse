import { invoke } from "@tauri-apps/api/core";

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  releaseUrl: string | null;
  releaseName: string | null;
  publishedAt: string | null;
}

interface RawUpdateStatus {
  current_version: string;
  latest_version: string | null;
  has_update: boolean;
  release_url: string | null;
  release_name: string | null;
  published_at: string | null;
}

export async function checkForUpdate(): Promise<UpdateStatus> {
  const raw = await invoke<RawUpdateStatus>("check_for_update");
  return {
    currentVersion: raw.current_version,
    latestVersion: raw.latest_version,
    hasUpdate: raw.has_update,
    releaseUrl: raw.release_url,
    releaseName: raw.release_name,
    publishedAt: raw.published_at
  };
}

export async function openReleasePage(url: string): Promise<void> {
  const { open } = await import("@tauri-apps/plugin-shell");
  await open(url);
}
