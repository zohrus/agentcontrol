/** What a ticket looks like; anything else (it comes from the URL) never reaches a header. */
const TICKET = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * What a previewed page may load: its own ticket folder and nothing else of the app (so not /api,
 * not another session's ticket), never `'self'`, which inside a sandbox would mean the whole app.
 * The origin is the request's own, which the server's Host check has already limited to the app's
 * loopback address. An unknown ticket gets `'none'`.
 */
function sourcesOf(options: { origin: string; ticket: string }): string[] {
  if (!TICKET.test(options.ticket)) return ["'none'"];
  const own = `${options.origin}/preview/${options.ticket}/`;
  return [own, "data:", "blob:", "'unsafe-inline'", "'unsafe-eval'"];
}

/**
 * The Content-Security-Policy of a preview response. `sandbox` without `allow-same-origin` gives
 * the page an opaque origin: it cannot read the app's storage and its requests carry no
 * credentials. Scripts and styles may be inline or `eval`ed, because agent-made pages need them.
 * `connect-src 'none'` stops fetch, XHR and WebSocket altogether, and `form-action 'none'` stops a
 * form from posting anywhere.
 */
function previewPolicy(options: { origin: string; ticket: string }): string {
  return [
    "sandbox allow-scripts allow-forms",
    `default-src ${sourcesOf(options).join(" ")}`,
    "connect-src 'none'",
    "form-action 'none'",
    "frame-ancestors 'self'",
  ].join("; ");
}

/** Script, style, font and wasm files: what a sandboxed page loads with CORS (modules, fonts). */
const CORS_TYPES = /^(?:text\/javascript|text\/css|font\/|application\/wasm)/;

/**
 * Fonts and module scripts of a sandboxed page (its origin is "null") are CORS requests, so they
 * need `Access-Control-Allow-Origin`. It is given only to such a request and only for such a file,
 * so a data file (`.json`, `.txt`) is never readable from another origin, ticket or not.
 */
function allowsCors(options: { requestOrigin: string | undefined; contentType: string }): boolean {
  return options.requestOrigin === "null" && CORS_TYPES.test(options.contentType);
}

/** Every header of a preview response, errors included. */
export function previewHeaders(options: {
  origin: string;
  requestOrigin: string | undefined;
  ticket: string;
  contentType: string;
}): Record<string, string> {
  return {
    "Content-Type": options.contentType,
    "Content-Security-Policy": previewPolicy(options),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    ...(allowsCors(options) && { "Access-Control-Allow-Origin": "*" }),
  };
}
