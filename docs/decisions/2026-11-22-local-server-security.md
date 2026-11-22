# Local server security (2026-11-22)

Approved by the owner. Code: `packages/app/src/security/` (one middleware on the root app, so every
route, the SSE stream and every page the app serves is covered, including routes added later).

## Context

The app listens on `http://127.0.0.1:<port>`. Any website open in the user's browser can make the
browser send requests there (cross-site request forgery), and with DNS rebinding can read the
answers. The API approves commands, starts sessions and writes files, and will change the UI and
agent config.

## What is checked, in this order

1. **Host.** `Host` must be `127.0.0.1:<port>`, `localhost:<port>` or `[::1]:<port>` for the port
   actually bound (compared case-insensitively). Anything else, or no `Host`: 403 `forbidden-host`.
   This stops DNS rebinding, because the rebound name is not one of those.
2. **Origin.** If `Origin` is present it must be `http://` plus one of those three hosts, exactly
   (`null`, other ports, `https`, lists: refused). `Sec-Fetch-Site` other than `same-origin` or
   `none` is refused too. 403 `forbidden-origin`. A missing `Origin` goes on to step 3.
3. **Secret.** 32 random bytes (base64url) made at every start, kept in memory and written to
   `<dataDir>/api-token` (mode 0600, replaced through a temporary file and rename). Every request
   under `/api` needs `Authorization: Bearer <token>`, compared in constant time (SHA-256 digests
   with `timingSafeEqual`). Otherwise 401 `unauthorized`.

The only requests allowed without the secret are `GET` and `HEAD` outside `/api`: the UI's page and
its scripts and styles (served by the app: Vite in dev, built files, the fallback page). They still
pass steps 1 and 2. They hold no data, and their handlers must never perform an action.

CORS stays closed: no `Access-Control-Allow-*` header is ever sent. Every response carries
`X-Content-Type-Options: nosniff`; API responses also `Cross-Origin-Resource-Policy: same-origin`.

## How each client gets the secret (and why no cookie)

- **Browser UI.** The app inserts `<meta name="agentcontrol-token" content="...">` into every
  `text/html` document it serves itself outside `/api` (and marks it `Cache-Control: no-store`, so a
  copy from before a restart is never reused). The SDK reads that tag and sends `Authorization:
  Bearer` on every call and on the live stream. Nothing under `/api` ever gets the tag, so an HTML
  file read from a session's worktree through the files API does not.
- **`/_safe`** (the recovery page) is an app document too, so it gets the tag. Its inline script
  reads the tag, sends `Authorization: Bearer` on each call and reloads once on 401. It imports
  neither the SDK nor the UI bundle, so it works when the UI is broken.
- **Token file.** Written synchronously right after the port is bound and before any request is
  handled, so a stale token is never readable and a start that cannot bind leaves the file alone.
- **Local programs** (the SDK under Bun, tests, the menu bar app) read `<dataDir>/api-token` and send
  the same header (`createClient({ baseUrl, token })`). The SDK never reads files (browser-safe).
- **Why not a cookie.** Cookies are not isolated by port: the browser would also send the cookie to
  every other server on `127.0.0.1` or `localhost`, such as a dev server an agent started running
  code the agent wrote. A header is sent only by our own client to our own address. A page cannot
  forge the header cross-site either.
- **Restart.** The secret is new at every start, so a tab loaded earlier gets 401. The SDK calls
  `onUnauthorized`; the UI (`data/recover.ts`) reloads once to pick up the new tag, guarded against
  loops with `sessionStorage` (cleared when the stream connects again).

## Not protected

- Other programs running as the same user can read `<dataDir>/api-token` (and the SQLite file, and
  the relay socket). That is the operating system's trust boundary; this does not defend against it.
- Any local process that can reach the loopback port (another macOS user, a sandboxed agent that
  may not read the token file) can `GET /` and read the tag in the page. This follows from letting
  the page load without a token, as the owner approved, and stays the same-user boundary. To close
  it later, hand the secret only through a one-time launch URL opened by the menu bar app.
- Other users on the machine: the token file and relay socket are 0600, but the data folder's own
  permissions are the user's choice.
- A page served on `127.0.0.1:<port>` itself (for example agent-made HTML if it were ever served
  from the app's origin) is same-origin and would receive the tag. Previews must use a separate,
  sandboxed origin (see `TASKS.md`, Browser support) and must not be served as app documents.
- Relay socket: already 0600 (`packages/relay/src/daemon/server.ts`); shared SSH workspaces in
  phase 5 still need their folder permissions checked.
