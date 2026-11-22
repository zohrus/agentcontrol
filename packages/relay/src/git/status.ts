export interface StatusEntry {
  status: string;
  path: string;
}

function entryOf(token: string): StatusEntry | undefined {
  if (token.length <= 3) return undefined;
  return { status: token.slice(0, 2).trim(), path: token.slice(3) };
}

/** Parses `git status --porcelain=v1 -z` into entries (rename sources skipped). */
export function parseStatus(output: string): StatusEntry[] {
  const tokens = output.split("\0");
  const entries: StatusEntry[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i] ?? "";
    const entry = entryOf(token);
    if (entry) entries.push(entry);
    i += /^[RC]/.test(token) ? 2 : 1;
  }
  return entries;
}
