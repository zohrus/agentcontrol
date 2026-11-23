import DOMPurify from "dompurify";
import { Marked } from "marked";

const marked = new Marked({ gfm: true, async: false });

const STYLE = `
:root { color-scheme: light dark; --fg: #161a22; --bg: #ffffff; --line: #dde1e8; --code: #eef0f4; --link: #2f5bd3; }
@media (prefers-color-scheme: dark) {
  :root { --fg: #e6e9ef; --bg: #181c24; --line: #2a303c; --code: #20252f; --link: #86a5ff; }
}
body { margin: 0; padding: 16px 20px; background: var(--bg); color: var(--fg);
  font: 14px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; overflow-wrap: anywhere; }
h1, h2, h3 { line-height: 1.25; margin: 1.2em 0 0.5em; }
h1 { font-size: 1.6em; border-bottom: 1px solid var(--line); padding-bottom: 0.2em; }
a { color: var(--link); }
img { max-width: 100%; }
code, pre { font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--code); border-radius: 4px; }
code { padding: 0.1em 0.3em; }
pre { padding: 10px 12px; overflow-x: auto; }
pre code { padding: 0; background: none; }
table { border-collapse: collapse; }
th, td { border: 1px solid var(--line); padding: 4px 10px; }
blockquote { margin-left: 0; padding-left: 12px; border-left: 3px solid var(--line); opacity: 0.85; }
`;

const escapeAttribute = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

/** Where relative links and images point: the file's folder in the preview, and the load number. */
type Anchor = { base: string; version: string };

/** A link or image address that is relative to the Markdown file (not `#frag`, `https:`, `//` or `\\\\`). */
const isRelative = (address: string): boolean =>
  !address.startsWith("#") && !/^[\\/]{2}/.test(address) && !/^[a-z][a-z0-9+.-]*:/i.test(address);

/** Points a relative address into the preview folder; images also carry the load number. */
function resolved(address: string, call: { anchor: Anchor; image: boolean }): string {
  const url = new URL(address, call.anchor.base);
  if (call.image) url.searchParams.set("v", call.anchor.version);
  return url.href;
}

/**
 * Relative addresses are written out in full (a `<base>` tag would also turn every `#section`
 * link into a trip to the preview folder), and every link opens in a new tab that has no way back.
 */
function rewriteNode(node: Element, anchor: Anchor): void {
  rewriteAddresses(node, anchor);
  if (opensInNewTab(node)) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
}

function rewriteAddresses(node: Element, anchor: Anchor): void {
  for (const name of ["src", "href"]) {
    const address = node.getAttribute(name);
    if (address !== null && isRelative(address)) {
      node.setAttribute(name, resolved(address, { anchor, image: name === "src" }));
    }
  }
}

/** A link that leaves the document; a link to a section of it stays. */
function opensInNewTab(node: Element): boolean {
  const href = node.getAttribute("href");
  return node.tagName.toLowerCase() === "a" && href !== null && !href.startsWith("#");
}

/** Markdown turned into safe HTML: scripts, event handlers, SVG and the like are removed. */
function markdownToSafeHtml(call: { source: string; anchor: Anchor }): string {
  const purify = DOMPurify(window);
  purify.addHook("afterSanitizeAttributes", (node) => {
    rewriteNode(node, call.anchor);
  });
  return purify.sanitize(marked.parse(call.source, { async: false }), {
    FORBID_TAGS: ["style", "form", "svg", "math"],
  });
}

/**
 * A whole page for the sandboxed frame. Relative links and images are rewritten to `base` (the
 * preview folder of the file), and the page may load images from previews and `data:` only.
 */
export function markdownDocument(call: { source: string; base: string; version: string }): string {
  const previews = `${new URL(call.base).origin}/preview/`;
  const policy = `default-src 'none'; img-src ${previews} data:; style-src 'unsafe-inline'`;
  const anchor = { base: call.base, version: call.version };
  return [
    "<!doctype html><html><head><meta charset=utf-8>",
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(policy)}">`,
    `<style>${STYLE}</style></head><body>`,
    markdownToSafeHtml({ source: call.source, anchor }),
    "</body></html>",
  ].join("");
}
