import type { AiCommitProvider, AiCommitStyle } from "../stores/settings";
import { invoke } from "@tauri-apps/api/core";

export interface AiCommitConfig {
  provider: AiCommitProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  style: AiCommitStyle;
  includeBody: boolean;
  maxDiffChars: number;
}

export interface GeneratedCommitMessage {
  subject: string;
  body: string;
}

export async function generateCommitMessage(
  diff: string,
  config: AiCommitConfig
): Promise<GeneratedCommitMessage> {
  if (!config.model.trim()) {
    throw new Error("Choose an AI model in Settings first.");
  }
  if (config.provider !== "ollama" && !config.apiKey.trim()) {
    throw new Error("Add an API key in Settings first.");
  }

  const prompt = buildPrompt(diff.slice(0, config.maxDiffChars), config);
  const { text } = await invoke<{ text: string }>("ai_generate_commit_message", {
    request: {
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      prompt
    }
  });
  return parseGeneratedMessage(text);
}

function buildPrompt(diff: string, config: AiCommitConfig) {
  const styleInstruction =
    config.style === "conventional"
      ? "Use Conventional Commits style when appropriate, for example `feat: ...` or `fix: ...`."
      : "Use a clear imperative plain-English subject.";
  const bodyInstruction = config.includeBody
    ? "Include a short body only when it adds useful context."
    : "Return an empty body.";
  return [
    "Generate a Git commit message from this staged diff.",
    styleInstruction,
    bodyInstruction,
    "Return only JSON with this exact shape:",
    '{"subject":"...","body":"..."}',
    "Keep the subject at 72 characters or fewer.",
    "",
    "STAGED DIFF:",
    diff
  ].join("\n");
}

function parseGeneratedMessage(text: string): GeneratedCommitMessage {
  const candidate = extractJsonObject(
    text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  );
  let parsed: Partial<GeneratedCommitMessage>;
  try {
    parsed = JSON.parse(candidate) as Partial<GeneratedCommitMessage>;
  } catch {
    const preview = text.trim().replace(/\s+/g, " ").slice(0, 180);
    throw new Error(
      `AI provider returned invalid JSON${preview ? `: ${preview}` : "."}`
    );
  }
  const subject = parsed.subject?.trim();
  if (!subject) {
    throw new Error("AI provider returned no commit subject.");
  }
  return {
    subject,
    body: parsed.body?.trim() ?? ""
  };
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}
