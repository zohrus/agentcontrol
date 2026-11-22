import { join } from "node:path";
import type { ConfigAgent, ConfigItem, ScopedItem } from "@agentcontrol/protocol";
import type { ConfigCtx, Place } from "./types.ts";

export type Obj = Record<string, unknown>;

export const asRecord = (v: unknown): Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : {};

export const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export const asText = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

export function asStringMap(v: unknown): Record<string, string> {
  const entries = Object.entries(asRecord(v)).filter(
    (e): e is [string, string] => typeof e[1] === "string",
  );
  return Object.fromEntries(entries);
}

export async function readJsonObject(ctx: ConfigCtx, path: string): Promise<Obj> {
  const raw = await ctx.readFile(path);
  try {
    return raw === undefined ? {} : asRecord(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function scoped(item: ConfigItem, place: Place, ctx: ConfigCtx): ScopedItem {
  const scope = place.global
    ? { scope: "global" as const }
    : { scope: "repo" as const, repoPath: ctx.repoPath ?? place.base };
  return { item, scope, enabled: true };
}

export function places(ctx: ConfigCtx): Place[] {
  const found: Place[] = [{ global: true, base: ctx.homeDir }];
  if (ctx.repoPath !== undefined) found.push({ global: false, base: ctx.repoPath });
  return found;
}

const BLOCK = /<!-- agentcontrol:begin (\S+) -->\n([\s\S]*?)\n<!-- agentcontrol:end \1 -->\n?/g;

/** Managed blocks come back under their own ids; the rest of the file is one hand-written item. */
export function instructionItems(input: {
  agent: ConfigAgent;
  content: string | undefined;
  place: Place;
  ctx: ConfigCtx;
}): ScopedItem[] {
  const { agent, content = "", place, ctx } = input;
  const items: ScopedItem[] = [...content.matchAll(BLOCK)].map((m) => {
    const id = m[1] ?? "";
    return scoped({ id, kind: "instructions", name: id, text: m[2] ?? "" }, place, ctx);
  });
  const rest = content.replace(BLOCK, "").trim();
  if (rest === "") return items;
  const id = `${agent}:instructions:${place.global ? "global" : "repo"}`;
  return [...items, scoped({ id, kind: "instructions", name: "existing", text: rest }, place, ctx)];
}

/** Paths below a skills folder grouped by the skill folder they sit in. */
function groupByFolder(relatives: string[]): Map<string, string[]> {
  const byName = new Map<string, string[]>();
  for (const rel of relatives) {
    const slash = rel.indexOf("/");
    if (slash < 0) continue;
    const name = rel.slice(0, slash);
    byName.set(name, [...(byName.get(name) ?? []), rel.slice(slash + 1)]);
  }
  return byName;
}

async function readSkillFiles(input: {
  ctx: ConfigCtx;
  dir: string;
  name: string;
  paths: string[];
}) {
  const { ctx, dir, name, paths } = input;
  return Promise.all(
    paths.map(async (path) => ({
      path,
      content: (await ctx.readFile(join(dir, name, path))) ?? "",
    })),
  );
}

export async function skillItems(input: {
  agent: ConfigAgent;
  dir: string;
  place: Place;
  ctx: ConfigCtx;
}): Promise<ScopedItem[]> {
  const { agent, dir, place, ctx } = input;
  const groups = groupByFolder(await ctx.listFiles(dir));
  return Promise.all(
    [...groups].map(async ([name, paths]) => {
      const files = await readSkillFiles({ ctx, dir, name, paths });
      return scoped({ id: `${agent}:skill:${name}`, kind: "skill", name, files }, place, ctx);
    }),
  );
}

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/;

function descriptionOf(front: string | undefined): string | undefined {
  const text = /^description:\s*(.*)$/m.exec(front ?? "")?.[1];
  return text === undefined ? undefined : unquote(text);
}

function parseCommand(raw: string): { description?: string; prompt: string } {
  const m = FRONT_MATTER.exec(raw);
  const prompt = (m?.[2] ?? raw).trimEnd();
  const description = descriptionOf(m?.[1]);
  return description === undefined ? { prompt } : { description, prompt };
}

function unquote(text: string): string {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "string" ? value : text;
  } catch {
    return text;
  }
}

export async function commandItems(input: {
  agent: ConfigAgent;
  dir: string;
  place: Place;
  ctx: ConfigCtx;
}): Promise<ScopedItem[]> {
  const { agent, dir, place, ctx } = input;
  const names = (await ctx.listFiles(dir)).filter((f) => f.endsWith(".md") && !f.includes("/"));
  return Promise.all(
    names.map(async (file) => {
      const name = file.slice(0, -3);
      const parsed = parseCommand((await ctx.readFile(join(dir, file))) ?? "");
      return scoped(
        { id: `${agent}:command:${name}`, kind: "command", name, ...parsed },
        place,
        ctx,
      );
    }),
  );
}
