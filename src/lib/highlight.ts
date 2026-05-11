import type { HighlighterCore } from "shiki/core";
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

// Dynamic imports of grammars — loaded lazily on first use. Keeping these as
// thunks means the build splits each grammar into its own chunk and Vite skips
// fetching anything we never touch. See UX-SPEC §7.4.
const languageLoaders: Record<string, () => Promise<unknown>> = {
  bash: () => import("@shikijs/langs/bash"),
  c: () => import("@shikijs/langs/c"),
  cpp: () => import("@shikijs/langs/cpp"),
  css: () => import("@shikijs/langs/css"),
  go: () => import("@shikijs/langs/go"),
  html: () => import("@shikijs/langs/html"),
  java: () => import("@shikijs/langs/java"),
  javascript: () => import("@shikijs/langs/javascript"),
  json: () => import("@shikijs/langs/json"),
  jsx: () => import("@shikijs/langs/jsx"),
  markdown: () => import("@shikijs/langs/markdown"),
  python: () => import("@shikijs/langs/python"),
  ruby: () => import("@shikijs/langs/ruby"),
  rust: () => import("@shikijs/langs/rust"),
  sql: () => import("@shikijs/langs/sql"),
  toml: () => import("@shikijs/langs/toml"),
  tsx: () => import("@shikijs/langs/tsx"),
  typescript: () => import("@shikijs/langs/typescript"),
  yaml: () => import("@shikijs/langs/yaml")
};

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

// ---- Highlighter singleton (created on first use) ----

let highlighterPromise: Promise<HighlighterCore> | null = null;
const loadedLanguages = new Set<string>();
const inFlightLoads = new Map<string, Promise<void>>();

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const [{ createHighlighterCore }, { createOnigurumaEngine }, wasm, githubDark, githubLight] =
        await Promise.all([
          import("shiki/core"),
          import("shiki/engine/oniguruma"),
          import("shiki/wasm"),
          import("@shikijs/themes/github-dark"),
          import("@shikijs/themes/github-light")
        ]);

      return createHighlighterCore({
        themes: [githubDark.default, githubLight.default],
        langs: [],
        engine: createOnigurumaEngine(wasm)
      });
    })();
  }
  return highlighterPromise;
}

async function ensureLanguage(lang: string) {
  if (lang === "text" || loadedLanguages.has(lang)) {
    return;
  }
  const inflight = inFlightLoads.get(lang);
  if (inflight) {
    return inflight;
  }
  const loader = languageLoaders[lang];
  if (!loader) {
    loadedLanguages.add(lang);
    return;
  }
  const next = (async () => {
    const highlighter = await getHighlighter();
    const mod = (await loader()) as { default: unknown };
    await highlighter.loadLanguage(mod.default as Parameters<HighlighterCore["loadLanguage"]>[0]);
    loadedLanguages.add(lang);
  })();
  inFlightLoads.set(lang, next);
  try {
    await next;
  } finally {
    inFlightLoads.delete(lang);
  }
}

// ---- Bounded line cache (LRU) ----

const LINE_CACHE_MAX = 5000;
const lineCache = new Map<string, Promise<string>>();

function cacheGet(key: string) {
  const value = lineCache.get(key);
  if (value !== undefined) {
    // Refresh recency by re-inserting (Map iteration is insertion order).
    lineCache.delete(key);
    lineCache.set(key, value);
  }
  return value;
}

function cacheSet(key: string, value: Promise<string>) {
  lineCache.set(key, value);
  if (lineCache.size > LINE_CACHE_MAX) {
    // Evict the oldest. Map's first key is the oldest insertion.
    const oldest = lineCache.keys().next().value;
    if (oldest !== undefined) {
      lineCache.delete(oldest);
    }
  }
}

export function highlightLine(filePath: string, code: string, themeMode: ThemeMode) {
  const lang = inferLanguage(filePath);
  const cacheKey = `${themeMode}:${lang}:${code}`;
  const existing = cacheGet(cacheKey);
  if (existing) {
    return existing;
  }

  const next = (async () => {
    if (lang === "text") {
      return escapeHtml(code);
    }
    await ensureLanguage(lang);
    const highlighter = await getHighlighter();
    const html = highlighter.codeToHtml(code, {
      lang,
      theme: themeMode === "light" ? "github-light" : "github-dark"
    });
    return extractCodeHtml(html);
  })().catch(() => escapeHtml(code));

  cacheSet(cacheKey, next);
  return next;
}

function extractCodeHtml(html: string) {
  const match = html.match(/<code>([\s\S]*?)<\/code>/);
  return match?.[1] ?? escapeHtml(html);
}
