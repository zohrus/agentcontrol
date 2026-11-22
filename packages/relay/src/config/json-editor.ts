import type { Editor } from "./types.ts";

/**
 * Keys are path segments joined by SEP. A last segment starting with "=" names a string inside an
 * array ("=Bash(git:*)"); one starting with "#" names an array element whose JSON carries the hook
 * marker for that id. Any other segment is an object key.
 */
const SEP = "\u001f";
export const HOOK_MARK = " # agentcontrol:";

type Obj = Record<string, unknown>;
type Node = Obj | unknown[];

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null;
const isMember = (seg: string): boolean => seg.startsWith("=") || seg.startsWith("#");
const lastOf = (segs: string[]): string => segs[segs.length - 1] ?? "";

function parse(content: string): Obj {
  if (content.trim() === "") return {};
  const value: unknown = JSON.parse(content);
  if (!isObj(value)) throw new Error("expected a JSON object at the top level");
  return value;
}

function childOf(cur: Obj, seg: string, fresh: Node | undefined): Node | undefined {
  if (cur[seg] === undefined && fresh) cur[seg] = fresh;
  const next = cur[seg];
  return isNode(next) ? next : undefined;
}

const emptyFor = (segs: string[], i: number): Node =>
  i === segs.length - 2 && isMember(lastOf(segs)) ? [] : {};

/** The chain of containers from the root down to the parent of the last segment. */
function walk(root: Obj, segs: string[], create: boolean): Node[] | undefined {
  const chain: Node[] = [root];
  for (const [i, seg] of segs.slice(0, -1).entries()) {
    const cur = chain[chain.length - 1];
    const next = isObj(cur) ? childOf(cur, seg, create ? emptyFor(segs, i) : undefined) : undefined;
    if (!next) return undefined;
    chain.push(next);
  }
  return chain;
}

function indexIn(arr: unknown[], seg: string): number {
  const id = seg.slice(1);
  if (seg.startsWith("=")) return arr.indexOf(id);
  return arr.findIndex((el) => JSON.stringify(el).includes(`${HOOK_MARK}${id}"`));
}

function readLeaf(parent: Node, seg: string): unknown {
  if (!Array.isArray(parent)) return parent[seg];
  return parent[indexIn(parent, seg)];
}

/** The commands of a hook group without the marker, to recognise a hand-written copy of it. */
function plainCommands(group: unknown): string {
  const hooks = isObj(group) && Array.isArray(group.hooks) ? (group.hooks as unknown[]) : [];
  const commands = hooks.map((h) => (isObj(h) && typeof h.command === "string" ? h.command : ""));
  const matcher = isObj(group) ? group.matcher : undefined;
  return JSON.stringify([matcher, commands.map((c) => c.split(HOOK_MARK)[0])]);
}

/** Where a new array member goes: over an identical hand-written hook, so importing it twice never duplicates. */
function slotFor(arr: unknown[], seg: string, value: unknown): number {
  const same = seg.startsWith("#")
    ? arr.findIndex(
        (el) =>
          !JSON.stringify(el).includes(HOOK_MARK) && plainCommands(el) === plainCommands(value),
      )
    : -1;
  return same < 0 ? arr.length : same;
}

function writeLeaf(parent: Node, seg: string, value: unknown): void {
  if (!Array.isArray(parent)) {
    parent[seg] = value;
    return;
  }
  const at = indexIn(parent, seg);
  parent[at < 0 ? slotFor(parent, seg, value) : at] = value;
}

function deleteLeaf(parent: Node, seg: string): void {
  if (Array.isArray(parent)) parent.splice(indexIn(parent, seg), 1);
  else Reflect.deleteProperty(parent, seg);
}

const isEmpty = (node: Node): boolean =>
  Array.isArray(node) ? node.length === 0 : Object.keys(node).length === 0;

const removable = (node: Node | undefined, parent: Node | undefined): parent is Obj =>
  node !== undefined && isObj(parent) && isEmpty(node);

function prune(chain: Node[], segs: string[]): void {
  for (let i = chain.length - 1; i > 0; i--) {
    const parent = chain[i - 1];
    if (!removable(chain[i], parent)) return;
    Reflect.deleteProperty(parent, segs[i - 1] ?? "");
  }
}

function render(root: Obj, original: string): string {
  const newline = original === "" || original.endsWith("\n") ? "\n" : "";
  return `${JSON.stringify(root, null, 2)}${newline}`;
}

export const keyOf = (...segs: string[]): string => segs.join(SEP);

export const jsonEditor: Editor = {
  get(content, key) {
    const segs = key.split(SEP);
    const parent = walk(parse(content), segs, false)?.at(-1);
    const value = parent ? readLeaf(parent, lastOf(segs)) : undefined;
    return value === undefined ? undefined : JSON.stringify(value);
  },
  set(content, key, value) {
    const segs = key.split(SEP);
    const root = parse(content);
    const parent = walk(root, segs, true)?.at(-1);
    if (!parent) throw new Error(`cannot place ${segs.join(" > ")}: a parent is not an object`);
    const parsed: unknown = JSON.parse(value);
    writeLeaf(parent, lastOf(segs), parsed);
    return render(root, content);
  },
  remove(content, key) {
    const segs = key.split(SEP);
    const root = parse(content);
    const chain = walk(root, segs, false);
    const parent = chain?.at(-1);
    if (!chain || !parent || readLeaf(parent, lastOf(segs)) === undefined) return content;
    deleteLeaf(parent, lastOf(segs));
    prune(chain, segs);
    return render(root, content);
  },
};
