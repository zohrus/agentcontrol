import { IDE_MAX_REQUEST_BYTES, RelayName as N, type SessionId } from "@agentcontrol/protocol";
import type { Link } from "../sync/index.ts";
import { BodyStream } from "./body-stream.ts";

/** Headers of one hop of a connection: not passed on to code-server. */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  // Cookies ignore ports: the browser sends those of every server on 127.0.0.1. They stay here.
  "cookie",
  "authorization",
]);

/** Headers of code-server's answer that are dropped: it has no login, so a cookie is only a leak. */
const NOT_PASSED_BACK = new Set(["set-cookie", "set-cookie2"]);

/** Statuses whose answer has no body. */
const NO_BODY = new Set([101, 204, 205, 304]);

const text = (status: number, message: string): Response =>
  new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

const TOO_BIG = "That upload is too big for the tunnel.";

/** The request's headers as pairs, without the ones that belong to this hop. */
export function forwardedHeaders(headers: Headers): [string, string][] {
  return [...headers.entries()].filter(([name]) => !HOP_BY_HOP.has(name.toLowerCase()));
}

/**
 * The address holds the ticket, so a link out of the workbench must not carry it as a referrer;
 * code-server's own policy is kept when it sends one.
 */
function withReferrerPolicy(headers: [string, string][]): [string, string][] {
  const kept = headers.filter(([name]) => !NOT_PASSED_BACK.has(name.toLowerCase()));
  const has = kept.some(([name]) => name.toLowerCase() === "referrer-policy");
  return has ? kept : [...kept, ["referrer-policy", "no-referrer"]];
}

const isGetOrHead = (request: Request): boolean =>
  request.method === "GET" || request.method === "HEAD";

const declaredTooBig = (request: Request): boolean =>
  Number(request.headers.get("content-length")) > IDE_MAX_REQUEST_BYTES;

/** The request's body as base64, `undefined` when there is none, or the refusal when it is too big. */
async function readBody(request: Request): Promise<string | undefined | Response> {
  if (isGetOrHead(request)) return undefined;
  if (declaredTooBig(request)) return text(413, TOO_BIG);
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length > IDE_MAX_REQUEST_BYTES) return text(413, TOO_BIG);
  return bytes.length === 0 ? undefined : bytes.toString("base64");
}

/** What a browser is told when the workspace cannot be reached. */
function unreachable(error: unknown): Response {
  const reason = error instanceof Error ? error.message : String(error);
  return text(502, `The browser VS Code on this workspace did not answer: ${reason}`);
}

type Tunnel = ReturnType<typeof openTunnel>;

/** One request in flight: its id, the body that fills as the relay sends it, and how to end it. */
function openTunnel(link: Link) {
  const tunnelId = crypto.randomUUID();
  const close = (): void => {
    void link.call(N.ideClose, { tunnelId }).catch(() => undefined);
  };
  const body = new BodyStream({
    acknowledge: (bytes) => {
      void link.call(N.ideAck, { tunnelId, bytes }).catch(() => undefined);
    },
    abandon: close,
  });
  const stop = link.onIde(tunnelId, (signal) => {
    body.hear(signal);
    if (signal.type !== "body") stop();
  });
  return { tunnelId, body: body.stream, stop, close };
}

interface Call {
  link: Link;
  sessionId: SessionId;
  request: Request;
  /** Path and query as code-server sees them: the ticket is already taken off. */
  path: string;
}

async function relayAnswer(call: Call & { body: string | undefined; tunnel: Tunnel }) {
  const { link, sessionId, request, path, body, tunnel } = call;
  const { tunnelId } = tunnel;
  const headers = forwardedHeaders(request.headers);
  const params = { sessionId, tunnelId, method: request.method, path, headers };
  const result = await link.call(N.ideRequest, { ...params, ...(body && { body }) });
  const empty = NO_BODY.has(result.status) || request.method === "HEAD";
  if (empty) {
    tunnel.stop();
    tunnel.close();
  }
  const answered = withReferrerPolicy(result.headers);
  return new Response(empty ? null : tunnel.body, { status: result.status, headers: answered });
}

/**
 * Sends one browser request to the session's code-server through the workspace's relay, and
 * streams the answer back. The body is held back by the browser's own reading speed.
 */
export async function proxyRequest(call: Call): Promise<Response> {
  const body = await readBody(call.request);
  if (body instanceof Response) return body;
  const tunnel = openTunnel(call.link);
  // The browser gave up (a reload) while the relay was still answering: end the tunnel.
  call.request.signal.addEventListener("abort", () => {
    tunnel.stop();
    tunnel.close();
  });
  try {
    return await relayAnswer({ ...call, body, tunnel });
  } catch (error) {
    tunnel.stop();
    tunnel.close();
    return unreachable(error);
  }
}
