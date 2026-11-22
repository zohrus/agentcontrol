import { lstat, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { PermissionPolicy } from "@agentcontrol/protocol";
import type { PermissionAnswer, PermissionRequest } from "../agents/index.ts";

/** What the relay decided for one permission request, and why, in plain words. */
export interface PolicyDecision {
  answer: PermissionAnswer;
  reason: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Keys under which the agents put the path of a file tool's target. */
const INPUT_PATH_KEYS = ["file_path", "path", "notebook_path"];

function pathsOfContent(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  return content.flatMap((item: unknown) =>
    isRecord(item) && item["type"] === "diff" && typeof item["path"] === "string"
      ? [item["path"]]
      : [],
  );
}

function pathsOfLocations(locations: unknown): string[] {
  if (!Array.isArray(locations)) return [];
  return locations.flatMap((item: unknown) =>
    isRecord(item) && typeof item["path"] === "string" ? [item["path"]] : [],
  );
}

function pathsOfInput(rawInput: unknown): string[] {
  if (!isRecord(rawInput)) return [];
  return INPUT_PATH_KEYS.flatMap((key) => {
    const value = rawInput[key];
    return typeof value === "string" ? [value] : [];
  });
}

/** Every path the tool call says it touches: locations, diffs and the raw tool input. */
function touchedPaths(toolCall: unknown): string[] {
  if (!isRecord(toolCall)) return [];
  return [
    ...pathsOfLocations(toolCall["locations"]),
    ...pathsOfContent(toolCall["content"]),
    ...pathsOfInput(toolCall["rawInput"]),
  ];
}

/**
 * The path with symlinks resolved; a file that does not exist yet resolves through its folder.
 * Undefined when it cannot be resolved safely: a link that leads nowhere is not "a new file".
 */
async function realPathOf(path: string): Promise<string | undefined> {
  const absolute = resolve(path);
  const real = await realpath(absolute).catch(() => undefined);
  if (real !== undefined) return real;
  if (
    await lstat(absolute).then(
      () => true,
      () => false,
    )
  )
    return undefined;
  const parent = dirname(absolute);
  if (parent === absolute) return absolute;
  const realParent = await realPathOf(parent);
  return realParent === undefined ? undefined : join(realParent, basename(absolute));
}

async function isInside(options: { folder: string; path: string }): Promise<boolean> {
  const folder = await realPathOf(options.folder);
  const target = await realPathOf(options.path);
  if (folder === undefined || target === undefined) return false;
  return isBelow(relative(folder, target));
}

/** A relative path that stays inside its start folder (and is not the folder itself). */
function isBelow(rel: string): boolean {
  const escapes = rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
  return rel !== "" && !escapes;
}

async function allInside(folder: string, paths: string[]): Promise<boolean> {
  const checks = await Promise.all(paths.map((path) => isInside({ folder, path })));
  return checks.every(Boolean);
}

function optionOfKind(request: PermissionRequest, kinds: string[]): string | undefined {
  for (const kind of kinds) {
    const found = request.options.find((option) => option.kind === kind);
    if (found) return found.optionId;
  }
  return undefined;
}

function deny(request: PermissionRequest, reason: string): PolicyDecision {
  const optionId = optionOfKind(request, ["reject_once", "reject_always"]);
  return { answer: optionId === undefined ? { cancelled: true } : { optionId }, reason };
}

function allow(request: PermissionRequest, reason: string): PolicyDecision {
  const optionId = optionOfKind(request, ["allow_once"]);
  return optionId === undefined
    ? deny(request, "The agent offered no way to allow once.")
    : { answer: { optionId }, reason };
}

function toolKindOf(toolCall: unknown): unknown {
  return isRecord(toolCall) ? toolCall["kind"] : undefined;
}

/**
 * Decides a directory session's permission request. Only a file edit whose every path resolves
 * (symlinks followed) inside `allowEditsUnder` is allowed, once; everything else is refused.
 */
export async function decidePermission(options: {
  request: PermissionRequest;
  policy: PermissionPolicy;
  /** The session's folder; relative paths in the request are relative to it. */
  cwd: string;
}): Promise<PolicyDecision> {
  const { request, policy } = options;
  if (toolKindOf(request.toolCall) !== "edit") {
    return deny(request, "Only file edits are allowed in this session.");
  }
  const paths = touchedPaths(request.toolCall).map((path) => resolve(options.cwd, path));
  if (paths.length === 0) return deny(request, "The edit did not say which file it changes.");
  if (!(await allInside(policy.allowEditsUnder, paths))) {
    return deny(request, `Edits outside ${policy.allowEditsUnder} are not allowed.`);
  }
  return allow(request, `Edits inside ${policy.allowEditsUnder} are allowed.`);
}
