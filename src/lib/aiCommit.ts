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

  const prompt = buildPrompt(prepareAiDiffContext(diff, config.maxDiffChars), config);
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
    "Generate a Git commit message from this staged diff summary and representative hunks.",
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

interface DiffFileSection {
  path: string;
  additions: number;
  deletions: number;
  hunks: string[];
}

export function prepareAiDiffContext(diff: string, maxChars: number) {
  if (diff.length <= maxChars) {
    return diff;
  }

  const files = parseDiffSections(diff);
  if (files.length === 0) {
    return `${diff.slice(0, maxChars)}\n\n[diff truncated]`;
  }

  const summary = buildFileSummary(files, maxChars);
  const parts = [summary];
  let used = summary.length;
  let addedAnyHunk = false;

  for (let round = 0; ; round += 1) {
    let addedThisRound = false;
    for (const file of files) {
      const hunk = file.hunks[round];
      if (!hunk) continue;

      const next = `\n\n### ${file.path}\n${hunk}`;
      if (used + next.length > maxChars) {
        continue;
      }
      parts.push(next);
      used += next.length;
      addedAnyHunk = true;
      addedThisRound = true;
    }

    if (!addedThisRound) {
      break;
    }
  }

  if (!addedAnyHunk) {
    const fallbackBudget = Math.max(0, maxChars - summary.length - 20);
    return `${summary}\n\n${diff.slice(0, fallbackBudget)}\n[diff truncated]`;
  }

  return parts.join("");
}

function parseDiffSections(diff: string): DiffFileSection[] {
  return diff
    .split(/^diff --git /m)
    .filter(Boolean)
    .map((section) => {
      const fullSection = `diff --git ${section}`;
      const path =
        fullSection.match(/^diff --git a\/.+? b\/(.+)$/m)?.[1] ??
        fullSection.match(/^\+\+\+ b\/(.+)$/m)?.[1] ??
        "unknown";
      const lines = fullSection.split("\n");
      const additions = lines.filter(
        (line) => line.startsWith("+") && !line.startsWith("+++")
      ).length;
      const deletions = lines.filter(
        (line) => line.startsWith("-") && !line.startsWith("---")
      ).length;
      const hunks = splitHunks(fullSection);
      return { path, additions, deletions, hunks };
    });
}

function splitHunks(section: string) {
  const hunks: string[] = [];
  let current: string[] | null = null;

  for (const line of section.split("\n")) {
    if (line.startsWith("@@")) {
      if (current) {
        hunks.push(current.join("\n").trimEnd());
      }
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }

  if (current) {
    hunks.push(current.join("\n").trimEnd());
  }

  if (hunks.length > 0) return hunks;
  return [section.trimEnd()];
}

function buildFileSummary(files: DiffFileSection[], maxChars: number) {
  const prefix = "FILES CHANGED:";
  const suffix = "\n\nREPRESENTATIVE HUNKS:";
  const lines: string[] = [prefix];
  let used = prefix.length + suffix.length;
  let omitted = 0;

  for (const file of files) {
    const next = `\n- ${file.path}: +${file.additions} -${file.deletions}`;
    if (used + next.length > Math.floor(maxChars * 0.45)) {
      omitted += 1;
      continue;
    }
    lines.push(next);
    used += next.length;
  }

  if (omitted > 0) {
    lines.push(`\n- ... ${omitted} additional file${omitted === 1 ? "" : "s"}`);
  }

  return `${lines.join("")}${suffix}`;
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
