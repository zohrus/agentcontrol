import { listConfigItems, replaceConfigItems } from "./config-items.ts";
import { openDatabase } from "./db.ts";
import {
  eventsAfter,
  lastSeqs,
  replaceSessionEvents,
  saveEvents,
  sessionsNormalisedBefore,
} from "./events.ts";
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
    saveEvents: (call) => {
      saveEvents(db, call);
    },
    replaceSessionEvents: (call) => {
      replaceSessionEvents(db, call);
    },
    sessionsNormalisedBefore: (call) => sessionsNormalisedBefore(db, call),
    lastSeqs: (workspaceId) => lastSeqs(db, workspaceId),
    eventsAfter: (query) => eventsAfter(db, query),
    saveSessionSummaries: (workspaceId, list) => {
      saveSessionSummaries(db, workspaceId, list);
    },
    listSessions: (filter) => listSessions(db, filter),
    getSession: (key) => getSession(db, key),
    replaceConfigItems: (items) => {
      replaceConfigItems(db, items);
    },
    listConfigItems: () => listConfigItems(db),
    close: () => {
      sqlite.close();
    },
  };
}
