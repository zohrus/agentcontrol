import type { ConfigAgent, UnsupportedItem } from "@agentcontrol/protocol";
import { adoptHandWritten, sameValue } from "./adopt.ts";
import { editors } from "./editors.ts";
import { sha256 } from "./fs.ts";
import { REST_KEY } from "./markdown-editor.ts";
import type { Entry, Format, ManagedRef, ManifestFile, RenderCtx, RenderResult } from "./types.ts";

interface FileJob {
  file: string;
  agent: ConfigAgent;
  format: Format;
  entries: Entry[];
  current: string | undefined;
  owned: ManagedRef[];
}

interface FileOutcome {
  content: string;
  managed: ManifestFile | undefined;
  conflicts: Entry[];
}

function groupByFile(entries: Entry[]): Map<string, Entry[]> {
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) groups.set(entry.file, [...(groups.get(entry.file) ?? []), entry]);
  return groups;
}

/** Hand-written content already living at an entry's place is never overwritten. */
function splitConflicts(job: FileJob): { fresh: Entry[]; conflicts: Entry[] } {
  const editor = editors[job.format];
  const ownedKeys = new Set(job.owned.map((o) => o.key));
  const clashes = (e: Entry): boolean => {
    const existing = editor.get(job.current ?? "", e.key);
    return (
      !ownedKeys.has(e.key) &&
      e.key !== REST_KEY &&
      existing !== undefined &&
      !sameValue(e, existing)
    );
  };
  return {
    fresh: job.entries.filter((e) => !clashes(e)),
    conflicts: job.entries.filter(clashes),
  };
}

/** An entry already in the file as wanted is left exactly as it is, formatting included. */
function writeIfDifferent(content: string, entry: Entry): string {
  const editor = editors[entry.format];
  return sameValue(entry, editor.get(content, entry.key))
    ? content
    : editor.set(content, entry.key, entry.value);
}

function rewrite(job: FileJob, fresh: Entry[]): string {
  const editor = editors[job.format];
  const keep = new Set(fresh.map((e) => e.key));
  let content = job.current ?? "";
  for (const old of job.owned) if (!keep.has(old.key)) content = editor.remove(content, old.key);
  for (const entry of fresh) content = writeIfDifferent(content, entry);
  return content;
}

function editFile(job: FileJob): FileOutcome {
  const editor = editors[job.format];
  const { fresh, conflicts } = splitConflicts(job);
  const content = rewrite(job, fresh);
  const refs = fresh.map((e) => ({
    key: e.key,
    itemId: e.itemId,
    hash: sha256(editor.get(content, e.key) ?? ""),
  }));
  const managed =
    refs.length > 0 ? { agent: job.agent, format: job.format, entries: refs } : undefined;
  return { content, managed, conflicts };
}

const toUnsupported = (agent: ConfigAgent, entries: Entry[]): UnsupportedItem[] =>
  entries.map((e) => ({
    itemId: e.itemId,
    agent,
    reason: "something already exists there that this app did not write, so it was left alone",
  }));

const formatOf = (group: Entry[], prior: ManifestFile | undefined): Format =>
  group[0]?.format ?? prior?.format ?? "json";

const under = (path: string, root: string | undefined): boolean =>
  root !== undefined && path.startsWith(`${root}/`);

const GLOBAL_FOLDERS = [".claude", ".codex", ".agents", ".agentcontrol"];

/** The agents' own files in the home folder, not the repos that happen to live below it. */
const isGlobalFile = (file: string, home: string): boolean =>
  file === `${home}/.claude.json` ||
  GLOBAL_FOLDERS.some((folder) => under(file, `${home}/${folder}`));

/** A file this plan can speak for: the agents' global files, or a repo the plan was made for. */
const inScope = (file: string, ctx: RenderCtx): boolean =>
  isGlobalFile(file, ctx.homeDir) ||
  [ctx.repoPath, ...(ctx.repoPaths ?? [])].some((repo) => under(file, repo));

/** What we own in repos this plan does not cover stays owned, untouched. */
function carryOver(input: {
  agent: ConfigAgent;
  entries: Entry[];
  ctx: RenderCtx;
}): RenderResult["managed"] {
  const { agent, entries, ctx } = input;
  const wanted = new Set(entries.map((e) => e.file));
  const kept = Object.entries(ctx.manifest.files).filter(
    ([file, owned]) => owned.agent === agent && !wanted.has(file) && !inScope(file, ctx),
  );
  return Object.fromEntries(kept);
}

/** One job per native file: those with desired entries, and those we own but no longer want. */
async function jobsFor(input: {
  agent: ConfigAgent;
  entries: Entry[];
  ctx: RenderCtx;
}): Promise<FileJob[]> {
  const { agent, entries, ctx } = input;
  const groups = groupByFile(entries);
  for (const [file, owned] of Object.entries(ctx.manifest.files)) {
    if (owned.agent === agent && !groups.has(file) && inScope(file, ctx)) groups.set(file, []);
  }
  return Promise.all(
    [...groups].map(async ([file, group]) => {
      const prior = ctx.manifest.files[file];
      const format = formatOf(group, prior);
      const current = await ctx.readFile(file);
      const entries = group.map((entry) => adoptHandWritten(entry, current));
      return { file, agent, format, entries, current, owned: prior?.entries ?? [] };
    }),
  );
}

/** Turn desired entries into the full desired content of each native file they live in. */
export async function buildFiles(input: {
  agent: ConfigAgent;
  entries: Entry[];
  ctx: RenderCtx;
}): Promise<RenderResult> {
  const managed = carryOver(input);
  const result: RenderResult = { files: new Map(), deleted: [], managed, unsupported: [] };
  for (const job of await jobsFor(input)) collect({ result, job, outcome: editFile(job) });
  return result;
}

/** A whole file that does not exist yet is a change even when its content is empty. */
const changed = (job: FileJob, outcome: FileOutcome): boolean =>
  job.format === "file" ? outcome.content !== job.current : outcome.content !== (job.current ?? "");

/** A whole-file entry we owned and no longer want means the file should disappear. */
const shouldDelete = (job: FileJob, outcome: FileOutcome): boolean =>
  job.format === "file" && outcome.managed === undefined && job.owned.length > 0;

function collect(input: { result: RenderResult; job: FileJob; outcome: FileOutcome }): void {
  const { result, job, outcome } = input;
  result.unsupported.push(...toUnsupported(job.agent, outcome.conflicts));
  if (outcome.managed) result.managed[job.file] = outcome.managed;
  if (shouldDelete(job, outcome)) result.deleted.push(job.file);
  else if (changed(job, outcome)) result.files.set(job.file, outcome.content);
}
