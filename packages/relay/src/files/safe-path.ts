import { realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { ErrorCode } from "@agentcontrol/protocol";
import { RelayError } from "../rpc/index.ts";

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function realpathOfExisting(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    const parent = dirname(path);
    return parent === path ? path : realpathOfExisting(parent);
  }
}

/** Resolves a worktree-relative path; rejects anything escaping the worktree, symlinks included. */
export async function resolveInside(worktreePath: string, path: string): Promise<string> {
  const root = await realpath(worktreePath);
  const target = resolve(root, path);
  const real = await realpathOfExisting(target);
  if (isAbsolute(path) || !isInside(root, target) || !isInside(root, real)) {
    const message = `The path "${path}" is outside the session's folder, so it was not used.`;
    throw new RelayError(ErrorCode.invalidParams, message);
  }
  return target;
}
