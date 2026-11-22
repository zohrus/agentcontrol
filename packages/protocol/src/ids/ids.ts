import { z } from "zod";

/** Identifies one agent session on a relay. */
export const SessionId = z.string().min(1).brand<"SessionId">();
export type SessionId = z.infer<typeof SessionId>;

/** Identifies one workspace (a machine the relay runs on). */
export const WorkspaceId = z.string().min(1).brand<"WorkspaceId">();
export type WorkspaceId = z.infer<typeof WorkspaceId>;

/** Identifies one git repository registered with a relay. */
export const RepoId = z.string().min(1).brand<"RepoId">();
export type RepoId = z.infer<typeof RepoId>;
