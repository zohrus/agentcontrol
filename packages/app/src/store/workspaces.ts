import { sql } from "drizzle-orm";
import type { Db } from "./db.ts";
import { workspaces } from "./schema.ts";
import type { Workspace } from "./types.ts";

export function upsertWorkspace(db: Db, workspace: Workspace): void {
  const row = {
    ...workspace,
    sshHost: workspace.sshHost ?? null,
    lastSeenAt: workspace.lastSeenAt ?? null,
    removedAt: workspace.removedAt ?? null,
  };
  db.insert(workspaces).values(row).onConflictDoUpdate({ target: workspaces.id, set: row }).run();
}

/** Oldest first, so the local workspace (added first) leads. */
export function listWorkspaces(db: Db): Workspace[] {
  return db
    .select()
    .from(workspaces)
    .orderBy(sql`rowid`)
    .all()
    .map(({ sshHost, lastSeenAt, removedAt, ...rest }) => ({
      ...rest,
      ...(sshHost === null ? {} : { sshHost }),
      ...(lastSeenAt === null ? {} : { lastSeenAt }),
      ...(removedAt === null ? {} : { removedAt }),
    }));
}
