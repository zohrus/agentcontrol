import type { Db } from "./db.ts";
import { toWorkspace } from "./rows.ts";
import { workspaces } from "./schema.ts";
import type { Workspace } from "./types.ts";

export function upsertWorkspace(db: Db, workspace: Workspace): void {
  const row = {
    ...workspace,
    sshHost: workspace.sshHost ?? null,
    lastSeenAt: workspace.lastSeenAt ?? null,
  };
  db.insert(workspaces).values(row).onConflictDoUpdate({ target: workspaces.id, set: row }).run();
}

export function listWorkspaces(db: Db): Workspace[] {
  return db.select().from(workspaces).all().map(toWorkspace);
}
