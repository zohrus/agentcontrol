import type { ITheme } from "@xterm/xterm";

/** Reads a colour of the page's palette (`--surface`, `--fg`...) so the terminal matches it. */
function colour(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** The terminal's colours from the page's current light or dark palette. */
export function terminalTheme(): ITheme {
  return {
    background: colour("--surface"),
    foreground: colour("--fg"),
    cursor: colour("--fg"),
    selectionBackground: colour("--accent-soft"),
  };
}

/** Calls `onChange` when the system switches between light and dark; returns how to stop. */
export function onThemeChange(onChange: () => void): () => void {
  const query = matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}
