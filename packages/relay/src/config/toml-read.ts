import { tableNames, tomlEditor } from "./toml-editor.ts";

/** Best-effort reading of the simple one-line values this app and Codex docs use. Not a TOML parser. */

export function parseString(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(raw.replace(/\s+#.*$/, ""));
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function parseStrings(raw: string | undefined): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

const PAIR = /([A-Za-z0-9_-]+|"(?:[^"\\]|\\.)*")\s*=\s*("(?:[^"\\]|\\.)*")/g;

/** `key = "value"` pairs from an inline table or from the lines of a table body. */
export function parsePairs(text: string): Record<string, string> {
  const pairs = [...text.matchAll(PAIR)].map((m): [string, string] => [
    parseString(m[1]) ?? m[1] ?? "",
    parseString(m[2]) ?? "",
  ]);
  return Object.fromEntries(pairs);
}

/** The raw right-hand sides of `key = value` lines in a table body. */
export function parseLines(body: string | undefined): Record<string, string> {
  const rows = (body ?? "").split("\n").map((l) => /^\s*([A-Za-z0-9_-]+)\s*=\s*(.*)$/.exec(l));
  return Object.fromEntries(rows.flatMap((m) => (m?.[1] ? [[m[1], m[2] ?? ""]] : [])));
}

export const tableBody = (content: string, name: string): string | undefined =>
  tomlEditor.get(content, `table:${name}`);

export const topValue = (content: string, name: string): string | undefined =>
  tomlEditor.get(content, `key:${name}`);

/** Names of plain `[mcp_servers.<name>]` tables. */
export const serverNames = (content: string): string[] =>
  tableNames(content)
    .filter((n) => /^mcp_servers\.[A-Za-z0-9_-]+$/.test(n))
    .map((n) => n.slice("mcp_servers.".length));
