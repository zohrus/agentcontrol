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
import { listUsage, replaceUsage } from "./usage.ts";
import { listWorkspaces, upsertWorkspace } from "./workspaces.ts";

export type { Store, StoreOptions, StoredSession, Workspace } from "./types.ts";

/** Re-translated events: replace a session's stored ones, and find the sessions that need it. */
function normalisation(db: Db) {
  let revision = 0;
  return {
    revision: (): number => revision,
    replaceSessionEvents: (call: Parameters<Store["replaceSessionEvents"]>[0]): void => {
      replaceSessionEvents(db, call);
      revision += 1;
    },
    sessionsNormalisedBefore: (call: Parameters<Store["sessionsNormalisedBefore"]>[0]) =>
      sessionsNormalisedBefore(db, call),
  };
}

/** The usage rows analytics read: saved as the relay reports them, readable while it is offline. */
function usageStore(db: Db) {
  return {
    replaceUsage: (call: Parameters<Store["replaceUsage"]>[0]): void => {
      replaceUsage(db, call);
    },
    listUsage: () => listUsage(db),
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
    ...usageStore(db),
    replaceConfigItems: (items) => {
      replaceConfigItems(db, items);
    },
    listConfigItems: () => listConfigItems(db),
    close: () => {
      sqlite.close();
    },
  };
}
