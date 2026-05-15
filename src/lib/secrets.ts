import { invoke } from "@tauri-apps/api/core";

export async function getAiApiKey(provider: string) {
  return invoke<string | null>("ai_get_api_key", { provider });
}

export async function setAiApiKey(provider: string, apiKey: string) {
  return invoke<void>("ai_set_api_key", { provider, apiKey });
}
