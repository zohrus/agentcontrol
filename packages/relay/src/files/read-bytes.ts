import { constants } from "node:fs";
import { type FileHandle, open, realpath } from "node:fs/promises";
import { relative } from "node:path";
import { ErrorCode, FS_READ_BYTES_LIMIT } from "@agentcontrol/protocol";
import { RelayError } from "../rpc/index.ts";
import { resolveInside } from "./safe-path.ts";

/** A name git's own folder could go by; the Mac file system ignores letter case and trailing dots. */
const isGitFolder = (part: string): boolean => /^\.git[. ]*$/i.test(part);

/** Files that hold secrets: the worktree setup copies `.env*` files into every worktree. */
const isSecretFile = (part: string): boolean => /^\.(?:env|npmrc|netrc)/i.test(part);

const isWithheld = (part: string): boolean => isGitFolder(part) || isSecretFile(part);

function notFound(path: string): RelayError {
  return new RelayError(ErrorCode.fileNotFound, `"${path}" does not exist.`);
}

/** The whole file behind an open handle, as long as it is a regular file within the limit. */
async function readWhole(handle: FileHandle, path: string): Promise<Buffer> {
  const info = await handle.stat();
  if (!info.isFile()) throw notFound(path);
  if (info.size > FS_READ_BYTES_LIMIT) {
    const message = `"${path}" is bigger than ${String(FS_READ_BYTES_LIMIT)} bytes.`;
    throw new RelayError(ErrorCode.fileTooLarge, message);
  }
  return handle.readFile();
}

/**
 * Git's own folder and secret files are never handed over, whether the path names them or a link
 * in the worktree leads to them (`leak.js -> .env`): the names of the real location count too.
 */
async function realPathOfAllowedFile(options: {
  worktreePath: string;
  path: string;
}): Promise<string> {
  const { path } = options;
  const target = await resolveInside(options.worktreePath, path);
  refuseWithheld(path, path);
  const real = await realpath(target).catch(() => {
    throw notFound(path);
  });
  refuseWithheld(path, relative(await realpath(options.worktreePath), real));
  return real;
}

function refuseWithheld(path: string, names: string): void {
  if (names.split("/").some(isWithheld)) {
    throw new RelayError(ErrorCode.invalidParams, `"${path}" is not handed over.`);
  }
}

/**
 * The raw bytes of a working-copy file as base64, for files that are not text (images, fonts). A
 * missing file is `fileNotFound` and one over the limit is `fileTooLarge`; the size is taken from
 * the handle that is read, so it cannot change in between.
 */
export async function readBytes(options: {
  worktreePath: string;
  path: string;
}): Promise<{ base64: string }> {
  const real = await realPathOfAllowedFile(options);
  // Non-blocking, so a named pipe the agent made cannot hold the call open until it is written.
  const handle = await open(real, constants.O_RDONLY | constants.O_NONBLOCK).catch(() => {
    throw notFound(options.path);
  });
  try {
    return { base64: (await readWhole(handle, options.path)).toString("base64") };
  } finally {
    await handle.close();
  }
}
