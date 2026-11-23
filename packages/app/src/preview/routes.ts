import type { SessionId } from "@agentcontrol/protocol";
import { type Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { contentTypeOf } from "./content-types.ts";
import { previewHeaders } from "./headers.ts";
import type { Previews } from "./tickets.ts";

/** Why a file was not handed over, in words fit for the page that asked. */
interface Refusal {
  status: ContentfulStatusCode;
  message: string;
}

/** The bytes of a file, or the reason there are none. */
export type PreviewRead = { bytes: Uint8Array<ArrayBuffer> } | { refused: Refusal };

/** What the preview needs from the rest of the app: a session's state and its working files. */
export interface PreviewSource {
  /** False when the session is gone or archived. */
  isOpen(sessionId: SessionId): boolean;
  read(call: { sessionId: SessionId; path: string }): Promise<PreviewRead>;
}

const NOT_VALID: Refusal = {
  status: 404,
  message: "This preview link is not valid any more. Reload the Preview tab.",
};

const NOT_A_PATH: Refusal = { status: 400, message: "That is not a file path." };

const NO_FETCH: Refusal = {
  status: 403,
  message: "A page cannot read files with fetch or XHR. Load them as scripts, styles or images.",
};

/** A name the git folder could go by: the Mac file system ignores letter case and trailing dots. */
const isGitFolder = (part: string): boolean => /^\.git[. ]*$/i.test(part);

/** Files that hold secrets: the setup copies `.env*` files into every worktree. */
const isSecretFile = (part: string): boolean => /^\.(?:env|npmrc|netrc)/i.test(part);

const forbidden = (part: string): boolean =>
  ["", ".", ".."].includes(part) || isGitFolder(part) || isSecretFile(part) || /[\0\\]/.test(part);

/** The worktree-relative file a URL asks for (a folder means its index.html), if it is acceptable. */
function fileOf(rest: string): string | undefined {
  try {
    const decoded = decodeURIComponent(rest);
    const path = decoded === "" || decoded.endsWith("/") ? `${decoded}index.html` : decoded;
    return path.split("/").some(forbidden) ? undefined : path;
  } catch {
    return undefined;
  }
}

function reply(
  c: Context,
  call: {
    ticket: string;
    contentType: string;
    status: number;
    body: string | Uint8Array<ArrayBuffer>;
  },
) {
  const { origin } = new URL(c.req.url);
  const requestOrigin = c.req.header("origin");
  const { ticket, contentType } = call;
  const headers = previewHeaders({ origin, requestOrigin, ticket, contentType });
  return new Response(call.body, { status: call.status, headers });
}

function refuse(c: Context, call: { refusal: Refusal; ticket: string }): Response {
  const { refusal, ticket } = call;
  const contentType = "text/plain; charset=utf-8";
  return reply(c, { ticket, contentType, status: refusal.status, body: refusal.message });
}

/** The ticket and the rest of `/preview/<ticket>/<rest>`, as written in the URL (still escaped). */
function partsOf(c: Context): { ticket: string; rest: string; slash: boolean } {
  const { pathname } = new URL(c.req.url);
  const [, , ticket = "", ...rest] = pathname.split("/");
  return { ticket, rest: rest.join("/"), slash: rest.length > 0 };
}

/** The session a ticket may read: unknown, expired and archived-session tickets give nothing. */
function sessionOfTicket(deps: PreviewDeps, ticket: string): SessionId | undefined {
  const sessionId = deps.previews.sessionOf(ticket);
  if (sessionId === undefined || deps.source.isOpen(sessionId)) return sessionId;
  deps.previews.revoke(ticket);
  return undefined;
}

type Admitted = { sessionId: SessionId } | { refused: Response };

/** What a page's own files are loaded as; `fetch`, XHR and data imports are not. */
const PAGE_LOADS = new Set([
  ...["document", "iframe", "frame", "script", "style", "image", "font"],
  ...["audio", "video", "track", "object", "embed", "worker", "sharedworker"],
]);

/**
 * Who may read: a good ticket, asked for the way a page loads its own files. A page that leaked
 * its address to another site must not be readable from there with `fetch` or a data import. A
 * request that names no destination (a program, an old browser) passes: it needs the ticket anyway.
 */
function admit(c: Context, call: { deps: PreviewDeps; ticket: string }): Admitted {
  const { deps, ticket } = call;
  const dest = c.req.header("sec-fetch-dest");
  if (dest !== undefined && !PAGE_LOADS.has(dest)) {
    return { refused: refuse(c, { refusal: NO_FETCH, ticket: "" }) };
  }
  const sessionId = sessionOfTicket(deps, ticket);
  if (sessionId === undefined) return { refused: refuse(c, { refusal: NOT_VALID, ticket: "" }) };
  return { sessionId };
}

async function serve(c: Context, deps: PreviewDeps): Promise<Response> {
  const { ticket, rest, slash } = partsOf(c);
  const admitted = admit(c, { deps, ticket });
  if ("refused" in admitted) return admitted.refused;
  const { sessionId } = admitted;
  // Without the slash, relative links would resolve above the ticket folder.
  if (!slash) return c.redirect(`/preview/${ticket}/`, 308);
  const path = fileOf(rest);
  if (path === undefined) return refuse(c, { refusal: NOT_A_PATH, ticket });
  const read = await deps.source.read({ sessionId, path });
  if ("refused" in read) return refuse(c, { refusal: read.refused, ticket });
  const contentType = contentTypeOf(path);
  return reply(c, { ticket, contentType, status: 200, body: read.bytes });
}

export interface PreviewDeps {
  previews: Previews;
  source: PreviewSource;
}

/**
 * `/preview/<ticket>/<path>`: a session's working-copy files for an iframe to show. The ticket in
 * the URL is the only credential. These responses are never app documents: nothing is injected.
 */
export function previewRoutes(deps: PreviewDeps) {
  return new Hono().get("/:ticket/*", (c) => serve(c, deps));
}
