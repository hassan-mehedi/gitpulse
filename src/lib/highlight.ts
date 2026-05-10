import { codeToHtml, getSingletonHighlighter } from "shiki";
import type { ThemeMode } from "./theme";

const languageByExtension: Record<string, string> = {
  c: "c",
  cc: "cpp",
  cpp: "cpp",
  css: "css",
  go: "go",
  h: "c",
  htm: "html",
  html: "html",
  java: "java",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  md: "markdown",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  sql: "sql",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  txt: "text",
  yaml: "yaml",
  yml: "yaml"
};

const lineCache = new Map<string, Promise<string>>();

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function inferLanguage(filePath: string) {
  const extension = filePath.split(".").pop()?.toLowerCase();
  return (extension && languageByExtension[extension]) || "text";
}

export function highlightLine(filePath: string, code: string, themeMode: ThemeMode) {
  const lang = inferLanguage(filePath);
  const cacheKey = `${themeMode}:${lang}:${code}`;
  const existing = lineCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const next = (async () => {
    const highlighter = await getSingletonHighlighter({
      langs: [...new Set(Object.values(languageByExtension))],
      themes: ["github-dark", "github-light"]
    });
    const html = await codeToHtml(code, {
      lang,
      theme: themeMode === "light" ? "github-light" : "github-dark"
    });
    return extractCodeHtml(html);
  })();
  lineCache.set(cacheKey, next);
  return next;
}

function extractCodeHtml(html: string) {
  const match = html.match(/<code>([\s\S]*?)<\/code>/);
  return match?.[1] ?? escapeHtml(html);
}
