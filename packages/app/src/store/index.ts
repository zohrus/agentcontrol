import { listConfigItems, replaceConfigItems } from "./config-items.ts";
import { type Db, openDatabase } from "./db.ts";
import {
  eventsAfter,
  lastSeqs,
  replaceSessionEvents,
  saveEvents,
  sessionsNormalisedBefore,
} from "./events.ts";
import { findSessions, getSession, listSessions, saveSessionSummaries } from "./sessions.ts";
import type { Store, StoreOptions } from "./types.ts";
import { listWorkspaces, upsertWorkspace } from "./workspaces.ts";

export type { Store, StoreOptions, StoredSession, Workspace } from "./types.ts";

/** Re-translated events: replace a session's stored ones, and find the sessions that need it. */
function normalisation(db: Db) {
  return {
    replaceSessionEvents: (call: Parameters<Store["replaceSessionEvents"]>[0]): void => {
      replaceSessionEvents(db, call);
    },
    sessionsNormalisedBefore: (call: Parameters<Store["sessionsNormalisedBefore"]>[0]) =>
      sessionsNormalisedBefore(db, call),
  };
}

export function createStore({ path }: StoreOptions): Store {
  const { sqlite, db } = openDatabase(path);
  return {
    upsertWorkspace: (workspace) => {
      upsertWorkspace(db, workspace);
    },
    listWorkspaces: () => listWorkspaces(db),
    saveEvents: (call) => {
      saveEvents(db, call);
    },
    ...normalisation(db),
    lastSeqs: (workspaceId) => lastSeqs(db, workspaceId),
    eventsAfter: (query) => eventsAfter(db, query),
    saveSessionSummaries: (workspaceId, list) => {
      saveSessionSummaries(db, workspaceId, list);
    },
    listSessions: (filter) => listSessions(db, filter),
    getSession: (key) => getSession(db, key),
    findSessions: (sessionId) => findSessions(db, sessionId),
    replaceConfigItems: (items) => {
      replaceConfigItems(db, items);
    },
    listConfigItems: () => listConfigItems(db),
    close: () => {
      sqlite.close();
    },
  };
}
