/** Where a page asks which build is served; the answer holds nothing private. */
export const STATUS_PATH = "/_ui-build";

/** Which build the app serves, and whether the newest content of the UI folder failed to build. */
export interface Serving {
  /** The key of the build served; undefined when there is none yet. */
  key: string | undefined;
  failed: boolean;
}

/** What a page remembers of the build it came from; a reload follows when this changes. */
const markOf = (serving: Serving): string =>
  `${serving.key ?? "none"}|${serving.failed ? "failed" : "ok"}`;

/** The answer to a page that asks which build is served. */
export function statusAnswer(serving: Serving): Response {
  return Response.json({ mark: markOf(serving) }, { headers: { "cache-control": "no-store" } });
}

/**
 * Runs in the page: without hot reload, this is how a change to the UI reaches an open page.
 * It asks every two seconds which build is served, and reloads when it is not the page's own.
 */
function watchScript(serving: Serving): string {
  return `<script>(()=>{const mark="${markOf(serving)}";setInterval(async()=>{try{
const r=await fetch("${STATUS_PATH}",{cache:"no-store"});const s=await r.json();
if(s.mark!==mark)location.reload()}catch{}},2000)})()</script>`;
}

const BANNER_STYLE =
  "position:fixed;z-index:2147483647;top:0;left:0;right:0;padding:.5rem 1rem;font:14px system-ui,sans-serif;background:#fde8e8;color:#7a1212;border-bottom:1px solid #e0a0a0";

const BANNER = `<div role="alert" style="${BANNER_STYLE}">Your last change to the UI could not be built, so the version from before is shown. <a href="/_safe" style="color:inherit">Open the recovery page</a> to go back.</div>`;

/** The page with the notice (when the newest UI failed to build) and the script that follows builds. */
export async function withBuildNotes(options: {
  response: Response;
  serving: Serving;
}): Promise<Response> {
  const { response, serving } = options;
  const html = await response.text();
  const notes = (serving.failed ? BANNER : "") + watchScript(serving);
  const end = html.lastIndexOf("</body>");
  const page = end === -1 ? html + notes : html.slice(0, end) + notes + html.slice(end);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("cache-control", "no-store");
  return new Response(page, { status: response.status, headers });
}

const PLACEHOLDER_STYLE =
  "font:16px/1.5 system-ui,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1rem";

/** A page for when there is no build to show: the first one is still being made, or none worked. */
export function placeholderPage(serving: Serving): Response {
  const text = serving.failed
    ? 'The UI could not be built. <a href="/_safe">Open the recovery page</a> to see why and to go back to an earlier version.'
    : "Preparing your UI. This takes a few seconds; the page opens by itself.";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>AgentControl</title></head>
<body><div style="${PLACEHOLDER_STYLE}"><h1>AgentControl</h1><p>${text}</p></div>${watchScript(serving)}</body></html>`;
  const headers = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };
  return new Response(html, { status: 503, headers });
}
