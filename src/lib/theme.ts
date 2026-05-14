export type ThemeMode = "dark" | "light" | "dracula" | "atom";

export const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: "dark", label: "Dark Modern" },
  { value: "light", label: "Light Modern" },
  { value: "dracula", label: "Dracula" },
  { value: "atom", label: "Atom One Dark" }
];

export function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
}
