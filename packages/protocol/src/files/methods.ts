import { z } from "zod";
import { SessionId } from "../ids/index.ts";

const target = { sessionId: SessionId, path: z.string() };

/** Params of relay/fs.tree and relay/fs.watch. */
export const FsSessionParams = z.object({ sessionId: SessionId });

/** One file or directory in a session's worktree. */
export const FsEntry = z.object({
  path: z.string(),
  kind: z.enum(["file", "dir"]),
  gitStatus: z.string().optional(),
});
/** Result of relay/fs.tree. */
export const FsTreeResult = z.object({ entries: z.array(FsEntry) });

/** Params of relay/fs.read: which version of the file to read. */
export const FsReadParams = z.object({ ...target, ref: z.enum(["base", "head", "working"]) });
/** Result of relay/fs.read: the content and the hash to pass back on write. */
export const FsReadResult = z.object({ content: z.string(), hash: z.string() });

/** Most bytes `relay/fs.readBytes` hands over; a bigger file is a `fileTooLarge` error. */
export const FS_READ_BYTES_LIMIT = 10 * 1024 * 1024;
/** Params of relay/fs.readBytes: the working-copy file of a session, as raw bytes. */
export const FsReadBytesParams = z.object(target);
/** Result of relay/fs.readBytes: the file's bytes as base64 (binary-safe, unlike `fs.read`). */
export const FsReadBytesResult = z.object({ base64: z.string() });

/** Params of relay/fs.write: fails with staleFile if the hash no longer matches. */
export const FsWriteParams = z.object({
  ...target,
  content: z.string(),
  expectedHash: z.string(),
});
/** Result of relay/fs.write: the new hash. */
export const FsWriteResult = z.object({ hash: z.string() });

/** Result of relay/fs.watch; changes follow as relay/fs.changed notifications. */
export const FsWatchResult = z.object({});
/** Params of the relay/fs.changed notification. */
export const FsChangedParams = z.object({ sessionId: SessionId, paths: z.array(z.string()) });

export type FsSessionParams = z.infer<typeof FsSessionParams>;
export type FsEntry = z.infer<typeof FsEntry>;
export type FsTreeResult = z.infer<typeof FsTreeResult>;
export type FsReadParams = z.infer<typeof FsReadParams>;
export type FsReadResult = z.infer<typeof FsReadResult>;
export type FsReadBytesParams = z.infer<typeof FsReadBytesParams>;
export type FsReadBytesResult = z.infer<typeof FsReadBytesResult>;
export type FsWriteParams = z.infer<typeof FsWriteParams>;
export type FsWriteResult = z.infer<typeof FsWriteResult>;
export type FsWatchResult = z.infer<typeof FsWatchResult>;
export type FsChangedParams = z.infer<typeof FsChangedParams>;
