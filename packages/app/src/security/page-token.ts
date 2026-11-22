/** The name of the meta tag the SDK reads in the browser. */
const TOKEN_META_NAME = "agentcontrol-token";

/** True for a response that is a web page of the app's own. */
export function isHtml(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").toLowerCase().startsWith("text/html");
}

/** Puts the tag just inside `<head>` (or first, in a page without one). */
function insertInHead(html: string, tag: string): string {
  const head = /<head(\s[^>]*)?>/i.exec(html);
  const at = head ? head.index + head[0].length : 0;
  return html.slice(0, at) + tag + html.slice(at);
}

/**
 * The same page with the secret in `<meta name="agentcontrol-token">`, which is how the browser
 * UI learns it. No cookie: a cookie would also go to every other server on localhost. The page
 * is marked `no-store` so a copy made before an app restart (with the old secret) is never reused.
 */
export async function withTokenInPage(options: {
  response: Response;
  token: string;
}): Promise<Response> {
  const { response, token } = options;
  const tag = `<meta name="${TOKEN_META_NAME}" content="${token}">`;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("etag");
  headers.delete("last-modified");
  headers.set("cache-control", "no-store");
  const page = insertInHead(await response.text(), tag);
  return new Response(page, { status: response.status, headers });
}
