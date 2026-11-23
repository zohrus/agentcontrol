import { ApiError, type FileRef, isStaleFile, type SessionId } from "@agentcontrol/sdk";
import { type Context, inBackground } from "./context.ts";
import { describeError } from "./errors.ts";
import { fileKey, type FileVersions } from "./model.ts";
import { keyOf, type SessionRef } from "./session-ref.ts";

const STALE_NOTICE =
  "This file changed on disk while you were editing, so your edit was not saved. " +
  "The editor now shows the newer version; make your edit again on top of it.";

/** What the relay calls the hash of a file that is missing or empty (sha256 of nothing). */
const EMPTY_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const MISSING = { content: "", hash: EMPTY_HASH };
const NO_FILE: FileVersions = { base: "", working: "", hash: EMPTY_HASH, notice: undefined };

/** A file version, empty when that version does not exist (a new or deleted file). */
async function readVersion(ctx: Context, call: { id: SessionId; path: string; ref: FileRef }) {
  try {
    return await ctx.client.files.read(call);
  } catch (error) {
    if (error instanceof ApiError && error.code === "file-not-found") return MISSING;
    throw error;
  }
}

const fileOf = (ctx: Context, key: string): FileVersions => ctx.store.get().files[key] ?? NO_FILE;

function holdFile(ctx: Context, key: string, file: FileVersions): void {
  ctx.store.update((s) => ({ ...s, files: { ...s.files, [key]: file } }));
}

/** Loads a file's base and working versions; keeps its notice unless a new one is given. */
export async function loadFile(
  ctx: Context,
  call: { ref: SessionRef; path: string; notice?: string },
): Promise<void> {
  const { ref, path } = call;
  const { id } = ref;
  const [base, working] = await Promise.all([
    readVersion(ctx, { id, path, ref: "base" }),
    readVersion(ctx, { id, path, ref: "working" }),
  ]);
  const key = fileKey(ref, path);
  const notice = call.notice ?? fileOf(ctx, key).notice;
  holdFile(ctx, key, { base: base.content, working: working.content, hash: working.hash, notice });
}

function holdChangesError(ctx: Context, ref: SessionRef, message: string): void {
  const key = keyOf(ref);
  ctx.store.update((s) => ({ ...s, changesErrors: { ...s.changesErrors, [key]: message } }));
}

/** Loads a session's diff and file tree (which also starts live file-change events). */
export async function refreshChanges(ctx: Context, ref: SessionRef): Promise<void> {
  const key = keyOf(ref);
  try {
    const [diff, entries] = await Promise.all([
      ctx.client.sessions.diff(ref.id),
      ctx.client.files.tree(ref.id),
    ]);
    ctx.store.update((s) => ({
      ...s,
      diffs: { ...s.diffs, [key]: diff },
      trees: { ...s.trees, [key]: entries },
    }));
    holdChangesError(ctx, ref, "");
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    holdChangesError(ctx, ref, describeError(error));
  }
}

/** Saves an edit; when the file changed meanwhile, shows the newer version and says so. */
export async function saveFile(
  ctx: Context,
  call: { ref: SessionRef; path: string; content: string },
): Promise<void> {
  const { ref, path, content } = call;
  const key = fileKey(ref, path);
  const have = fileOf(ctx, key);
  try {
    const hash = await ctx.client.files.write({
      id: ref.id,
      path,
      content,
      expectedHash: have.hash,
    });
    holdFile(ctx, key, { base: have.base, working: content, hash, notice: undefined });
    inBackground(ctx, refreshChanges(ctx, ref));
  } catch (error) {
    if (!isStaleFile(error)) throw error;
    await loadFile(ctx, { ref, path, notice: STALE_NOTICE });
  }
}
