import type { Context, MiddlewareHandler } from "hono";
import { refusalFor } from "./origin.ts";
import { isHtml, withTokenInPage } from "./page-token.ts";
import { isToken } from "./token.ts";

export interface GuardOptions {
  token: string;
  /** The port the server is really listening on (known only once it has started). */
  port: () => number;
}

const unauthorized = {
  status: 401,
  code: "unauthorized",
  message: "This request carries no valid secret. Open the app's own page, or send the token.",
} as const;

function refuse(c: Context, refusal: { status: 401 | 403; code: string; message: string }) {
  return c.json({ error: { code: refusal.code, message: refusal.message } }, refusal.status);
}

function bearerOf(header: string | undefined): string | undefined {
  return /^Bearer (\S+)$/i.exec(header ?? "")?.[1];
}

const isApiPath = (path: string): boolean => path === "/api" || path.startsWith("/api/");

/** Previews of session files: not app documents, and authorised by the ticket in their address. */
const isPreviewPath = (path: string): boolean =>
  path === "/preview" || path.startsWith("/preview/");

/**
 * The only requests allowed without the secret: reading what the app serves outside `/api`, that
 * is the UI's page and its scripts and styles. They hold no data and must never perform an action.
 */
function readsAPage(c: Context): boolean {
  return (c.req.method === "GET" || c.req.method === "HEAD") && !isApiPath(c.req.path);
}

function setSafetyHeaders(c: Context): void {
  c.header("x-content-type-options", "nosniff");
  if (isApiPath(c.req.path)) c.header("cross-origin-resource-policy", "same-origin");
}

/** Answers made outside Hono (the UI's) do not pick up headers set earlier; set them on the result. */
function markAnswerSafe(c: Context): void {
  c.res.headers.set("x-content-type-options", "nosniff");
}

/**
 * Documents the app serves itself get the secret; nothing under `/api` ever does, and neither does
 * a preview: that is a page an agent wrote, and it must never see the secret. An answer with no
 * body (a 304 or a HEAD, even with an HTML content type) has no page to put it in.
 */
async function addTokenToDocument(c: Context, token: string): Promise<void> {
  if (isApiPath(c.req.path) || isPreviewPath(c.req.path)) return;
  if (!isHtml(c.res) || c.res.body === null) return;
  const page = await withTokenInPage({ response: c.res, token });
  // Hono copies the old headers over a new response; clear it first so the headers we dropped
  // (etag, content-length) and the no-store we set stay as they are.
  c.res = undefined;
  c.res = page;
}

/**
 * Applied to every route. Host check, Origin check, then the secret as `Authorization: Bearer`.
 * Without it only a read of a page outside `/api` passes.
 */
export function guard(options: GuardOptions): MiddlewareHandler {
  return async (c, next) => {
    setSafetyHeaders(c);
    const refusal = refusalFor({
      headers: c.req.raw.headers,
      port: options.port(),
      linkable: readsAPage(c),
      // A previewed page lives in a sandbox with an opaque origin, so its own files arrive with
      // `Origin: null` and `Sec-Fetch-Site: cross-site`. The ticket in the address authorises them.
      fromAnySite: isPreviewPath(c.req.path) && readsAPage(c),
    });
    if (refusal) return refuse(c, refusal);
    const given = bearerOf(c.req.header("authorization"));
    if (!isToken({ given, token: options.token }) && !readsAPage(c)) {
      return refuse(c, unauthorized);
    }
    await next();
    markAnswerSafe(c);
    await addTokenToDocument(c, options.token);
    return undefined;
  };
}
