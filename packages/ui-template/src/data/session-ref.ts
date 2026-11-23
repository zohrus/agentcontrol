import type { SessionRow } from "@agentcontrol/sdk";
import type { SessionRef } from "../session-list/index.ts";

export type { SessionRef };

/** The workspace of "This Mac", which every app has. */
export const LOCAL_WORKSPACE = "local";

/** The text a session is stored under: two workspaces may have a session with the same id. */
export const keyOf = (ref: SessionRef): string => `${ref.workspaceId}\u0000${ref.id}`;

/** The reference of a session row. */
export const refOf = (row: Pick<SessionRow, "workspaceId" | "id">): SessionRef => ({
  workspaceId: row.workspaceId,
  id: row.id,
});

/** True when the row is the referenced session. */
export const isRow = (row: SessionRow, ref: SessionRef | undefined): boolean =>
  sameSession(refOf(row), ref);

/** True when both references name the same session. */
export const sameSession = (a: SessionRef | undefined, b: SessionRef | undefined): boolean =>
  a !== undefined && b !== undefined && a.id === b.id && a.workspaceId === b.workspaceId;
