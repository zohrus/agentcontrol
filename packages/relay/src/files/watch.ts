import { watch } from "node:fs";

const IGNORED = new Set([".git", "node_modules"]);
const DEBOUNCE_MS = 100;

function isIgnored(path: string): boolean {
  return path.split("/").some((part) => IGNORED.has(part));
}

/** Calls onChange with the changed paths, debounced; returns a function that stops watching. */
export function watchFiles(worktreePath: string, onChange: (paths: string[]) => void): () => void {
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = (): void => {
    timer = undefined;
    onChange([...pending]);
    pending.clear();
  };
  const watcher = watch(worktreePath, { recursive: true }, (_event, name) => {
    // Bun reports an undefined name when the folder itself is removed (the session was archived).
    if (!name || isIgnored(name)) return;
    pending.add(name);
    timer ??= setTimeout(flush, DEBOUNCE_MS);
  });
  return () => {
    watcher.close();
    clearTimeout(timer);
  };
}
