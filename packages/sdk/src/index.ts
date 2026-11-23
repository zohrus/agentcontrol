import { hc } from "hono/client";
import type { AppType } from "@agentcontrol/app";
import { type AnalyticsFilter, type AnalyticsTableOptions, analyticsApi } from "./analytics.ts";
import { configApi } from "./config.ts";
import { authorizedFetch, tokenFromPage } from "./authorized-fetch.ts";
import { filesApi } from "./files.ts";
import { terminalApi } from "./terminal.ts";
import { modifyApi } from "./modify.ts";
import { sessionsApi } from "./sessions.ts";
import { type Listeners, subscribeTo } from "./subscribe.ts";
import { agentsApi, reposApi, workspaceApi } from "./workspace.ts";
import { workspacesApi } from "./workspaces.ts";

export { ApiError } from "./api-error.ts";
export type { AnalyticsFilter, AnalyticsTableOptions };
export type { ConfigTarget } from "./config.ts";
export type { FileContent, FileRef, WriteFile } from "./files.ts";
export { isStaleFile } from "./files.ts";
export type { StartSession } from "./sessions.ts";
export type { OpenTerminal, Terminal } from "./terminal.ts";
export type { Listeners } from "./subscribe.ts";
export type * from "./types.ts";
export type { InWorkspace, RepoWithSetup } from "./workspace.ts";
export type { AddWorkspace } from "./workspaces.ts";

export interface ClientOptions {
  /** Where the app listens, e.g. "http://127.0.0.1:4747". Use "" for same-origin in the browser. */
  baseUrl: string;
  /** How requests are sent; defaults to the global `fetch`. Lets the client point at something other than the local app. */
  fetch?: typeof fetch;
  /**
   * The app's secret, sent on every call and on the live stream as `Authorization: Bearer`.
   * Programs outside a browser (scripts, tests, the menu bar app) pass the content of
   * `<data folder>/api-token`. In the browser leave it out: the app puts the secret into the page
   * it serves (`<meta name="agentcontrol-token">`) and the client reads it from there.
   */
  token?: string | undefined;
  /**
   * Called when the app answers 401: its secret changed, usually because it restarted after this
   * page was loaded. Reloading the page fetches the new secret. May be called repeatedly while the
   * live stream retries, so guard against reload loops.
   */
  onUnauthorized?: (() => void) | undefined;
}

/** The one way the UI talks to the app. Every function throws ApiError when the app refuses. */
export function createClient({ baseUrl, fetch: sender = fetch, ...auth }: ClientOptions) {
  const send = authorizedFetch(sender, auth);
  const api = hc<AppType>(`${baseUrl}/api`, { fetch: send });
  return {
    analytics: analyticsApi(api),
    sessions: sessionsApi(api),
    files: filesApi(api, baseUrl),
    modify: modifyApi(api),
    config: configApi(api),
    repos: reposApi(api),
    workspace: workspaceApi(api),
    workspaces: workspacesApi(api),
    agents: agentsApi(api),
    terminal: terminalApi({ baseUrl, token: () => auth.token ?? tokenFromPage(), send }),
    /** Live updates. Returns a function that stops them. */
    subscribe: (listeners: Listeners): (() => void) =>
      subscribeTo({ streamUrl: `${baseUrl}/api/stream`, listeners, send }),
  };
}

export type Client = ReturnType<typeof createClient>;
