import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../stores/settings";

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function pickRepositoryDirectory() {
  if (!isTauriRuntime()) {
    return null;
  }

  const selection = await open({
    title: "Open Git Repository",
    directory: true,
    multiple: false
  });

  return typeof selection === "string" ? selection : null;
}

export async function pickWorkspaceFile() {
  if (!isTauriRuntime()) {
    return null;
  }

  const selection = await open({
    title: "Open Workspace File",
    multiple: false,
    filters: [
      {
        name: "Workspace Files",
        extensions: ["code-workspace"]
      }
    ]
  });

  return typeof selection === "string" ? selection : null;
}

export async function openFileInExternalEditor(
  repoPath: string,
  file: string,
  line?: number
) {
  if (!isTauriRuntime()) {
    return;
  }
  const editorCommand = useSettingsStore.getState().externalEditorCommand.trim() || undefined;
  await invoke("open_file_in_editor", { repoPath, file, line, editorCommand });
}

export async function revealFileInManager(repoPath: string, file: string) {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("reveal_file_in_manager", { repoPath, file });
}
