import { z } from "zod";
import { SessionId } from "../ids/index.ts";

/** One changed file in a session diff. */
export const DiffFile = z.object({
  path: z.string(),
  status: z.enum(["added", "modified", "deleted", "renamed"]),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
});
export type DiffFile = z.infer<typeof DiffFile>;

/** Params of relay/diff. */
export const DiffParams = z.object({ sessionId: SessionId });
/** Result of relay/diff: every change since the base commit, committed or not. */
export const DiffResult = z.object({
  baseCommit: z.string(),
  files: z.array(DiffFile),
  patch: z.string(),
});
