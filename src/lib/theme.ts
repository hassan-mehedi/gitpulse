export type ThemeMode = "dark" | "light";

export function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
}
