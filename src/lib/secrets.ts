import { LazyStore } from "@tauri-apps/plugin-store";
import { isTauriRuntime } from "./runtime";

const SECRETS_FILE = "secrets.json";
const LOCAL_STORAGE_KEY = "gitpulse-secrets";

const secretsStore = isTauriRuntime()
  ? new LazyStore(SECRETS_FILE, { defaults: {}, autoSave: 100 })
  : null;

function aiKeyName(provider: string) {
  return `ai.${provider}.apiKey`;
}

export async function getAiApiKey(provider: string): Promise<string | null> {
  if (secretsStore) {
    await secretsStore.init();
    const value = await secretsStore.get<string>(aiKeyName(provider));
    return typeof value === "string" ? value : null;
  }
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const value = parsed[aiKeyName(provider)];
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

export async function setAiApiKey(provider: string, apiKey: string): Promise<void> {
  const key = aiKeyName(provider);
  if (secretsStore) {
    await secretsStore.init();
    if (apiKey.trim() === "") {
      await secretsStore.delete(key);
    } else {
      await secretsStore.set(key, apiKey);
    }
    await secretsStore.save();
    return;
  }
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  const parsed: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  if (apiKey.trim() === "") {
    delete parsed[key];
  } else {
    parsed[key] = apiKey;
  }
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
}
