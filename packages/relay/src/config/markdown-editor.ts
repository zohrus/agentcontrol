import type { Editor } from "./types.ts";

const begin = (id: string): string => `<!-- agentcontrol:begin ${id} -->`;
const end = (id: string): string => `<!-- agentcontrol:end ${id} -->`;

/** Offsets of the whole block, markers included. */
function span(content: string, id: string): { start: number; stop: number } | undefined {
  const start = content.indexOf(begin(id));
  const close = content.indexOf(end(id), start);
  if (start < 0 || close < 0) return undefined;
  return { start, stop: close + end(id).length };
}

function separator(content: string): string {
  if (content === "" || content.endsWith("\n\n")) return "";
  return content.endsWith("\n") ? "\n" : "\n\n";
}

const block = (id: string, value: string): string => `${begin(id)}\n${value}\n${end(id)}`;

/** The key of the text outside every managed block: what the user wrote by hand. */
export const REST_KEY = "~rest";
const BLOCKS = /<!-- agentcontrol:begin (\S+) -->\n[\s\S]*?\n<!-- agentcontrol:end \1 -->\n?/g;

const restOf = (content: string): string => content.replace(BLOCKS, "").trim();

function withRest(content: string, rest: string): string {
  const blocks = [...content.matchAll(BLOCKS)].map((m) => m[0].trimEnd());
  const parts = [rest, ...blocks].filter((part) => part !== "");
  return parts.length === 0 ? "" : `${parts.join("\n\n")}\n`;
}

const byKey: Editor = {
  get: (content) => restOf(content) || undefined,
  set: (content, _key, value) => (restOf(content) === value ? content : withRest(content, value)),
  remove: (content) => content,
};

const blockEditor: Editor = {
  get(content, id) {
    const at = span(content, id);
    if (!at) return undefined;
    const inner = content.slice(at.start + begin(id).length, at.stop - end(id).length);
    return inner.replace(/^\n/, "").replace(/\n$/, "");
  },
  set(content, id, value) {
    const at = span(content, id);
    if (at) return content.slice(0, at.start) + block(id, value) + content.slice(at.stop);
    if (content.trim() === value.trim()) return `${block(id, value)}\n`;
    return `${content}${separator(content)}${block(id, value)}\n`;
  },
  remove(content, id) {
    const at = span(content, id);
    if (!at) return content;
    let head = content.slice(0, at.start);
    const tail = content.slice(at.stop).replace(/^\n/, "");
    if (tail === "" && head.endsWith("\n\n")) head = head.slice(0, -1);
    return `${head}${tail}`.trim() === "" ? "" : `${head}${tail}`;
  },
};

export const markdownEditor: Editor = {
  get: (content, key) => (key === REST_KEY ? byKey : blockEditor).get(content, key),
  set: (content, key, value) => (key === REST_KEY ? byKey : blockEditor).set(content, key, value),
  remove: (content, key) => (key === REST_KEY ? byKey : blockEditor).remove(content, key),
};

/** Whole-file ownership: the file is exactly the value. */
export const fileEditor: Editor = {
  get: (content) => (content === "" ? undefined : content),
  set: (_content, _key, value) => value,
  remove: () => "",
};
