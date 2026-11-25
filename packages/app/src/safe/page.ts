import type { ModifyState, ModifyStatus } from "../modify/index.ts";
import type { UiVersion } from "../ui-versions/index.ts";

const escapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Text that came from the user or an agent, made safe to put in HTML. */
const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => escapes[c] ?? c);

const STYLE = `body{font:15px/1.5 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#1c1c1c;background:#fafafa}
h1{font-size:1.3rem}h2{font-size:1rem;margin-top:2rem}li{margin:.4rem 0}small{color:#666}
button{font:inherit;padding:.25rem .7rem;margin-left:.5rem;cursor:pointer}
textarea{width:100%;font:inherit;box-sizing:border-box}pre{background:#eee;padding:.6rem;overflow:auto}
#error{color:#b00020}`;

/** Runs in the browser; knows nothing of the UI bundle or the SDK package, only the app's API. */
const SCRIPT = `
const KEY = "agentcontrol-safe-reloaded";
const secret = document.querySelector('meta[name="agentcontrol-token"]');
const authorized = (headers) => ({ ...headers, authorization: "Bearer " + (secret ? secret.content : "") });
/** Private windows may refuse session storage; then there is no memory, so it counts as "already reloaded". */
function stored(use) {
  try { return use(sessionStorage); } catch { return "1"; }
}
function expired(response) {
  // The app restarted and made a new secret: reload once to get the page that holds it.
  if (response.status !== 401 || stored((s) => s.getItem(KEY))) return false;
  stored((s) => s.setItem(KEY, "1"));
  location.reload();
  return true;
}
async function call(path, body) {
  const response = await fetch("/api/modify" + path, {
    method: "POST", headers: authorized({ "content-type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined });
  if (expired(response)) return;
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    document.getElementById("error").textContent = (data.error && data.error.message) || "That did not work.";
    return;
  }
  if (body && body.request) document.getElementById("request").value = "";
  await refresh();
}
/** Swaps in the status and version parts of a fresh page; the request box is left as it is. */
async function refresh() {
  const html = await fetch("/_safe").then((r) => r.text()).catch(() => undefined);
  if (!html) return;
  const next = new DOMParser().parseFromString(html, "text/html");
  if (!next.getElementById("status") || !next.getElementById("versions")) return;
  for (const id of ["status", "versions"]) document.getElementById(id).replaceWith(next.getElementById(id));
  document.body.dataset.status = next.body.dataset.status;
}
document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "restore") call("/restore", { commit: button.dataset.commit });
  else if (action === "send") {
    const text = document.getElementById("request").value.trim();
    if (text) call("", { request: text });
  } else call("/" + action);
});
setInterval(async () => {
  const response = await fetch("/api/modify", { headers: authorized({}) }).catch(() => undefined);
  if (!response || expired(response)) return;
  stored((s) => s.removeItem(KEY));
  const state = await response.json().catch(() => undefined);
  if (state && state.status !== document.body.dataset.status) await refresh();
}, 2000);
`;

const button = (action: string, label: string, commit = ""): string =>
  `<button data-action="${action}"${commit ? ` data-commit="${escapeHtml(commit)}"` : ""}>${label}</button>`;

const ACTIONS: Record<ModifyStatus, string> = {
  idle: "",
  working: button("discard", "Discard"),
  checking: "",
  fixing: "",
  ready: button("keep", "Keep") + button("undo", "Undo"),
  failed: button("discard", "Discard"),
};

const part = (value: string | undefined, render: (text: string) => string): string =>
  value ? render(value) : "";

const BUILD_FAILED =
  "The UI could not be built, so the version from before is shown. Restore an earlier version below, or ask the Modify agent for a fix.";

function stateSection(options: { state: ModifyState; buildFailure: string | undefined }): string {
  const { state, buildFailure } = options;
  const changed = state.changedFiles.map(escapeHtml).join(", ");
  return [
    part(
      buildFailure,
      (text) => `<p>${BUILD_FAILED}</p>\n<pre>${escapeHtml(text.slice(-4000))}</pre>`,
    ),
    `<p>Status: <b>${escapeHtml(state.status)}</b></p>`,
    part(state.request, (text) => `<p>Request: ${escapeHtml(text)}</p>`),
    part(state.failure, (text) => `<p>${escapeHtml(text)}</p>`),
    part(state.checkOutput, (text) => `<pre>${escapeHtml(text)}</pre>`),
    part(changed, (text) => `<p>Changed: ${text}</p>`),
    `<p>${ACTIONS[state.status]}</p>`,
  ]
    .filter((html) => html !== "")
    .join("\n");
}

function versionItem(version: UiVersion): string {
  const when = escapeHtml(version.createdAt.slice(0, 16).replace("T", " "));
  const text = `${escapeHtml(version.message)} <small>${escapeHtml(version.kind)}, ${when}</small>`;
  return `<li>${text}${button("restore", "Restore", version.commit)}</li>`;
}

/** The recovery page: plain HTML, no build step, works with the UI folder broken or missing. */
export function renderSafePage(options: {
  state: ModifyState;
  versions: UiVersion[];
  buildFailure: string | undefined;
}): string {
  const { state, versions, buildFailure } = options;
  const undo = state.status === "idle" ? button("undo", "Undo last change") : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AgentControl recovery</title><style>${STYLE}</style></head>
<body data-status="${escapeHtml(state.status)}">
<h1>AgentControl recovery</h1>
<p>This page is served by the app itself, so it works even when your UI is broken.</p>
<p id="error"></p>
<h2>Modify agent</h2>
<div id="status">
${stateSection({ state, buildFailure })}
<p>${undo}</p>
</div>
<textarea id="request" rows="3" placeholder="Describe a change to the UI"></textarea>
<p>${button("send", "Send")}</p>
<div id="versions">
<h2>Versions</h2>
<ul>${versions.map(versionItem).join("\n")}</ul>
</div>
<script>${SCRIPT}</script>
</body></html>`;
}
