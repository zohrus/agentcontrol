import type { Editor } from "./types.ts";

/**
 * Line-based TOML editor. Keys are "table:<dotted.name>" (a whole [table] section, its key/value
 * lines as the value) or "key:<name>" (a top-level key before the first table, `name = value`).
 * Everything else in the file is left untouched. See FORMATS.md for the limits.
 */
interface Doc {
  lines: string[];
  newline: boolean;
}

const HEADER = /^\s*\[\[?\s*([^[\]]+?)\s*\]\]?\s*(?:#.*)?$/;
const isBlank = (line: string): boolean => line.trim() === "" || line.trim().startsWith("#");

const open = (content: string): Doc => ({
  lines: content === "" ? [] : content.replace(/\n$/, "").split("\n"),
  newline: content === "" || content.endsWith("\n"),
});
const close = (doc: Doc): string =>
  doc.lines.length === 0 ? "" : doc.lines.join("\n") + (doc.newline ? "\n" : "");

const headerName = (line: string): string | undefined =>
  HEADER.exec(line)?.[1]?.replace(/\s*\.\s*/g, ".");

function firstHeader(lines: string[]): number {
  const at = lines.findIndex((l) => headerName(l) !== undefined);
  return at < 0 ? lines.length : at;
}

const isTable = (line: string, name: string): boolean =>
  headerName(line) === name && !line.trim().startsWith("[[");

/** Index after the last key/value line of the table body that starts at `from`. */
function bodyEnd(lines: string[], from: number): number {
  let stop = from;
  for (let i = from; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (headerName(line) !== undefined) break;
    if (!isBlank(line)) stop = i + 1;
  }
  return stop;
}

/** Index of the header line of a table and the index after its last key/value line. */
function tableSpan(lines: string[], name: string): { head: number; stop: number } | undefined {
  const head = lines.findIndex((l) => isTable(l, name));
  return head < 0 ? undefined : { head, stop: bodyEnd(lines, head + 1) };
}

const keyLine = (lines: string[], name: string): number =>
  lines.slice(0, firstHeader(lines)).findIndex((l) => new RegExp(`^\\s*${name}\\s*=`).test(l));

function setTable(doc: Doc, name: string, value: string): void {
  const at = tableSpan(doc.lines, name);
  const body = value === "" ? [] : value.split("\n");
  if (at) {
    doc.lines.splice(at.head + 1, at.stop - at.head - 1, ...body);
    return;
  }
  const last = doc.lines[doc.lines.length - 1];
  if (last !== undefined && last.trim() !== "") doc.lines.push("");
  doc.lines.push(`[${name}]`, ...body);
}

/** Where a new top-level key goes: after the last top-level line, before the first table. */
function keyPosition(lines: string[]): number {
  let pos = firstHeader(lines);
  while (pos > 0 && (lines[pos - 1] ?? "").trim() === "") pos--;
  return pos;
}

function setKey(doc: Doc, name: string, value: string): void {
  const line = `${name} = ${value}`;
  const at = keyLine(doc.lines, name);
  if (at >= 0) {
    doc.lines[at] = line;
    return;
  }
  const pos = keyPosition(doc.lines);
  doc.lines.splice(pos, 0, line);
  const next = doc.lines[pos + 1];
  if (next !== undefined && next.trim() !== "") doc.lines.splice(pos + 1, 0, "");
}

function getKey(doc: Doc, name: string): string | undefined {
  const line = doc.lines[keyLine(doc.lines, name)];
  return line?.slice(line.indexOf("=") + 1).trim();
}

/** The `name = value` line of a table that a dotted table name would define a second time. */
function inlineDefinition(doc: Doc, name: string): string | undefined {
  const dot = name.lastIndexOf(".");
  const parent = dot < 0 ? undefined : tableSpan(doc.lines, name.slice(0, dot));
  const key = name.slice(dot + 1);
  const lines = parent ? doc.lines.slice(parent.head + 1, parent.stop) : [];
  return lines.find((line) => new RegExp(`^\\s*${key}\\s*=`).test(line));
}

function getTable(doc: Doc, name: string): string | undefined {
  const at = tableSpan(doc.lines, name);
  return at ? doc.lines.slice(at.head + 1, at.stop).join("\n") : inlineDefinition(doc, name);
}

/** Removing a table must not leave two blank lines where one stood before it. */
function dropExtraBlank(doc: Doc, head: number, blankBefore: boolean): void {
  const next = doc.lines[head];
  const blankAfter = next === undefined || next.trim() === "";
  if (blankBefore && blankAfter) doc.lines.splice(next === undefined ? head - 1 : head, 1);
}

function removeTable(doc: Doc, name: string): void {
  const at = tableSpan(doc.lines, name);
  if (!at) return;
  const blankBefore = (doc.lines[at.head - 1] ?? "x").trim() === "";
  doc.lines.splice(at.head, at.stop - at.head);
  dropExtraBlank(doc, at.head, blankBefore);
}

const split = (key: string): [string, string] => {
  const i = key.indexOf(":");
  return [key.slice(0, i), key.slice(i + 1)];
};

export const tomlEditor: Editor = {
  get(content, key) {
    const [kind, name] = split(key);
    const doc = open(content);
    return kind === "table" ? getTable(doc, name) : getKey(doc, name);
  },
  set(content, key, value) {
    const [kind, name] = split(key);
    const doc = open(content);
    if (kind === "table") setTable(doc, name, value);
    else setKey(doc, name, value);
    return close(doc);
  },
  remove(content, key) {
    const [kind, name] = split(key);
    const doc = open(content);
    if (kind === "table") removeTable(doc, name);
    else if (keyLine(doc.lines, name) >= 0) doc.lines.splice(keyLine(doc.lines, name), 1);
    return close(doc);
  },
};

/** Names of the [tables] in a file, for inspecting. */
export const tableNames = (content: string): string[] =>
  open(content)
    .lines.map(headerName)
    .filter((n): n is string => n !== undefined);
