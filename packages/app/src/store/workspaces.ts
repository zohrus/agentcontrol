import type { Db } from "./db.ts";
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
