export type PreviewKind = "html" | "markdown";

const BY_EXTENSION = new Map<string, PreviewKind>([
  ["html", "html"],
  ["htm", "html"],
  ["md", "markdown"],
  ["markdown", "markdown"],
]);

/** What a file is shown as in the Preview tab, or undefined when it cannot be previewed. */
export function previewKindOf(path: string): PreviewKind | undefined {
  return BY_EXTENSION.get(/\.([^./]+)$/.exec(path)?.[1]?.toLowerCase() ?? "");
}

/** The folder of a worktree path, with its trailing slash ("" for a file at the top). */
function folderOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/") + 1);
}

/** True when a change could alter the page: the file itself, or anything in its folder or below. */
export function touchesPage(paths: readonly string[], page: string): boolean {
  const folder = folderOf(page);
  return paths.some((path) => path.startsWith(folder));
}
