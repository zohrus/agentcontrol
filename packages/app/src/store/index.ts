import { openDatabase } from "./db.ts";
import { eventsAfter, lastSeqs, saveEvents } from "./events.ts";
import { getSession, listSessions, saveSessionSummaries } from "./sessions.ts";
import type { Store, StoreOptions } from "./types.ts";
import { upsertWorkspace } from "./workspaces.ts";

export type { Store, StoreOptions, StoredSession, Workspace } from "./types.ts";

export function createStore({ path }: StoreOptions): Store {
  const { sqlite, db } = openDatabase(path);
  return {
    upsertWorkspace: (workspace) => {
      upsertWorkspace(db, workspace);
    },
    saveEvents: (workspaceId, list) => {
      saveEvents(db, workspaceId, list);
    },
    lastSeqs: (workspaceId) => lastSeqs(db, workspaceId),
    eventsAfter: (query) => eventsAfter(db, query),
    saveSessionSummaries: (workspaceId, list) => {
      saveSessionSummaries(db, workspaceId, list);
    },
    listSessions: (filter) => listSessions(db, filter),
    getSession: (key) => getSession(db, key),
    close: () => {
      sqlite.close();
    },
  };
}
