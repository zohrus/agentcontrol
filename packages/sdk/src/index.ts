import { hc } from "hono/client";
import type { AppType } from "@agentcontrol/app";
import { configApi } from "./config.ts";
import { filesApi } from "./files.ts";
import { sessionsApi } from "./sessions.ts";
import { type Listeners, subscribeTo } from "./subscribe.ts";
import { agentsApi, reposApi, workspaceApi } from "./workspace.ts";

export { ApiError } from "./api-error.ts";
export type { ConfigTarget } from "./config.ts";
export type { FileContent, FileRef, WriteFile } from "./files.ts";
export { isStaleFile } from "./files.ts";
export type { StartSession } from "./sessions.ts";
export type { Listeners } from "./subscribe.ts";
export type * from "./types.ts";
export type { RepoWithSetup } from "./workspace.ts";

export interface ClientOptions {
  /** Where the app listens, e.g. "http://127.0.0.1:4747". Use "" for same-origin in the browser. */
  baseUrl: string;
}

/** The one way the UI talks to the app. Every function throws ApiError when the app refuses. */
export function createClient({ baseUrl }: ClientOptions) {
  const api = hc<AppType>(`${baseUrl}/api`);
  return {
    sessions: sessionsApi(api),
    files: filesApi(api),
    config: configApi(api),
    repos: reposApi(api),
    workspace: workspaceApi(api),
    agents: agentsApi(api),
    /** Live updates. Returns a function that stops them. */
    subscribe: (listeners: Listeners): (() => void) =>
      subscribeTo(`${baseUrl}/api/stream`, listeners),
  };
}

export type Client = ReturnType<typeof createClient>;
