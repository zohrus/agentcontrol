import { IDE_MAX_REQUEST_BYTES, type SessionId } from "@agentcontrol/protocol";
import type { Server } from "bun";
import type { Previews } from "../preview/index.ts";
import { refusalFor } from "../security/index.ts";
import type { Link } from "../sync/index.ts";
import { proxyRequest } from "./request.ts";
import { type IdeSocketData, ideWebsocket, upgradeToIde } from "./socket.ts";

/** What the IDE's origin needs from the rest of the app. */
export interface IdeSource {
  /** False when the session is gone or archived. */
  isOpen(sessionId: SessionId): boolean;
  /** The relay of the session's workspace; throws when it is not connected. */
  linkOf(sessionId: SessionId): Link;
}

export interface IdeOrigin {
  /** The port actually bound: the IDE lives at `http://127.0.0.1:<port>/<ticket>/`. */
  port: number;
  stop: () => Promise<void>;
}

interface Options {
  tickets: Previews;
  source: IdeSource;
}

const plain = (status: number, message: string): Response =>
  new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" },
  });

/** The same answer for every address that is not a live ticket's: it says nothing about why. */
const notFound = (): Response => plain(404, "Not found.");

/** `/<ticket>/<rest>`: the ticket and what code-server is asked for (empty when there is no slash). */
function addressOf(url: URL): { ticket: string; rest: string } | undefined {
  const match = /^\/([A-Za-z0-9_-]{16,})(\/.*)?$/.exec(url.pathname);
  const [, ticket, rest] = match ?? [];
  return ticket === undefined
    ? undefined
    : { ticket, rest: rest === undefined ? "" : rest + url.search };
}

function refuseHost(request: Request, port: number): Response | undefined {
  const get = request.method === "GET" || request.method === "HEAD";
  const refusal = refusalFor({ headers: request.headers, port, linkable: get, fromAnySite: false });
  return refusal && plain(refusal.status, refusal.message);
}

/** The live ticket an address holds and its session; an expired one, or an archived session's, is dropped. */
function liveTicket(call: { options: Options; url: URL }) {
  const { tickets, source } = call.options;
  const address = addressOf(call.url);
  const sessionId = address && tickets.sessionOf(address.ticket);
  if (address === undefined || sessionId === undefined) return undefined;
  if (source.isOpen(sessionId)) return { ...address, sessionId };
  tickets.revoke(address.ticket);
  return undefined;
}

interface Entry {
  sessionId: SessionId;
  link: Link;
  path: string;
}

/** The relay of the session's workspace, or the plain refusal when it is not connected. */
function linked(call: { source: IdeSource; sessionId: SessionId; path: string }): Entry | Response {
  try {
    return { sessionId: call.sessionId, link: call.source.linkOf(call.sessionId), path: call.path };
  } catch (error) {
    return plain(503, error instanceof Error ? error.message : "The workspace is not connected.");
  }
}

/** Checks everything about a request before it goes anywhere: Host, Origin, ticket, workspace. */
function enter(request: Request, context: { options: Options; port: number }): Entry | Response {
  const refused = refuseHost(request, context.port);
  if (refused) return refused;
  const live = liveTicket({ options: context.options, url: new URL(request.url) });
  if (live === undefined) return notFound();
  if (live.rest === "") {
    return new Response(null, { status: 308, headers: { location: `/${live.ticket}/` } });
  }
  return linked({ source: context.options.source, sessionId: live.sessionId, path: live.rest });
}

const isWebSocket = (request: Request): boolean =>
  request.headers.get("upgrade")?.toLowerCase() === "websocket";

async function serve(
  request: Request,
  context: { options: Options; server: Server<IdeSocketData> },
) {
  const entry = enter(request, { options: context.options, port: context.server.port ?? 0 });
  if (entry instanceof Response) return entry;
  if (!isWebSocket(request)) return proxyRequest({ ...entry, request });
  const upgraded = await upgradeToIde({ ...entry, server: context.server, request });
  return upgraded ? undefined : plain(502, "The browser VS Code did not accept the connection.");
}

/**
 * The second listener: a different loopback port is a different origin, so a page from code-server
 * (third-party code with full JavaScript) is never same-origin with the app and cannot call its
 * API or read its page. It serves nothing but proxied code-server traffic, at `/<ticket>/...`.
 */
export function startIdeOrigin(options: Options): IdeOrigin {
  const server: Server<IdeSocketData> = Bun.serve<IdeSocketData>({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 0,
    maxRequestBodySize: IDE_MAX_REQUEST_BYTES,
    websocket: ideWebsocket,
    fetch: (request) => serve(request, { options, server }),
  });
  return { port: server.port ?? 0, stop: () => server.stop(true) };
}
