import { z } from "zod";

/**
 * One step of setting up a workspace, as it happens (the `workspace-progress` message on the live
 * stream). A step is `started`, then `ok` or `failed`; a failed one says why in `message`. The
 * steps carry the ids of the setup checklist (`connect`, `platform`, `install`, `relay`, then the
 * relay's own, `repos` last).
 */
export const WorkspaceProgress = z.object({
  /** What the caller of `workspaces.add` or `workspaces.check` passed, so it can find its own steps. */
  requestId: z.string(),
  /** The workspace the step is about, once it has an id. */
  workspaceId: z.string().optional(),
  step: z.string(),
  /** The step's name in plain words. */
  label: z.string(),
  state: z.enum(["started", "ok", "failed"]),
  /** What is being done, what was found, or why it failed. */
  message: z.string(),
});
export type WorkspaceProgress = z.infer<typeof WorkspaceProgress>;
