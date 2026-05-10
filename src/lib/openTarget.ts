import { open } from "@tauri-apps/plugin-dialog";

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
