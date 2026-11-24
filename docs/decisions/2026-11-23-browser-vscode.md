# Browser VS Code: code-server on the session's worktree (23 Nov 2026)

Code: `packages/relay/src/ide/`, `packages/app/src/ide/`, `api/ide.ts`, `start-ide.ts`,
`packages/sdk/src/ide.ts`, `packages/ui-template/src/ide/`; the scripted stand-in for tests is
`e2e/support/fake-code-server/`. Specification: the "Full IDE in the browser" item of
`docs/plan.html` (phase 5, optional) and `TASKS.md`.

## What it is

"Open in browser VS Code" (next to "Open in VS Code" in the session panel) starts a code-server on
the session's workspace, opened on the session's worktree, and shows it in a new tab. It works for
the local workspace and for ssh workspaces, and opens no port on the remote host.

## Decisions

- **code-server is the user's tool, not our dependency.** The relay looks for `code-server` on its
  PATH (on an ssh workspace the app already gives the relay the user's login-shell PATH, as for
  agents), runs `code-server --version` and reports it as an optional line of the workspace
  checklist: `found 4.x.y` (status `ok`), or `not installed (optional): install it with curl -fsSL
  https://code-server.dev/install.sh | sh` (status `skipped`, never a failure). Nothing is
  downloaded or installed by us, and there is no new npm dependency. `AGENTCONTROL_CODE_SERVER_CMD`
  (a JSON array, like the agent commands) overrides the lookup; tests use it for the scripted
  stand-in.
- **One code-server per session, on a unix socket, with `--auth none`.** Flags: `--socket
  <relay data>/ide/run/<hash>.sock --socket-mode 600 --auth none --disable-telemetry
  --disable-update-check --user-data-dir <relay data>/ide/user-data --extensions-dir <relay
  data>/ide/extensions --config <relay data>/ide/config.yaml <worktree>`. No `--bind-addr`, so no
  TCP port exists at all. `--auth none` is acceptable only because of that: the socket is mode 600
  and sits in `ide/` and `ide/run/` (both mode 700) inside the relay's own data folder, so only the
  relay's user can open it, and the only thing that does is the relay. Settings and extensions are
  per workspace, not per session, so installed extensions persist across sessions. The process is
  started in its own process group (`detached`), so stopping it (SIGTERM, SIGKILL after 3 s, and a
  final SIGKILL of the group even when the main process already died) also reaches the extension
  host and terminals it started. Each launch has its own socket name, so a server that is still
  ending cannot remove its successor's socket. Its environment is the relay's minus
  `AGENTCONTROL_*`, plus the session's `PORT` and `AGENTCONTROL_PORT_BASE`, like the Console.
  Tested (`e2e/ide/secrets.e2e.ts`): flags, socket and folder modes. The tests run as root, so they
  prove the mode bits, not a refusal for another user.
  - *Rejected: TCP on 127.0.0.1 with `--auth password`.* Another local user could reach the port
    and a password is one more secret to hand over. It would be the fallback if a code-server did
    not take `--socket`; the real 4.146.0 does (checked, below), so it is not built.
- **Lifetime.** A code-server ends when its session is archived (the `endTerminals` hook of
  archive now also stops it), when the relay stops (`stop` of the daemon), when it dies (it is
  forgotten, the next request starts a new one), and after 30 minutes with no connection into it
  (`AGENTCONTROL_IDE_IDLE_MS` overrides, used by tests). A connection is a request in flight or an
  open WebSocket, so a tab left open keeps it alive; a request that arrives after it ended starts
  it again. Not covered: the relay killed with SIGKILL leaves its code-servers running (see "Not
  done").
- **The tunnel is the relay link itself** (JSON-RPC over stdio or ssh), no forwarded port.
  Methods: `relay/ide.status`, `.start`, `.stop`, `.request` (one HTTP request: method, path,
  headers as pairs, base64 body up to 16 MiB; the answer is status and headers), `.ack`, `.close`,
  `.socket.open` (path, headers, subprotocols; the answer names the subprotocol code-server chose),
  `.socket.send`. Notifications: `relay/ide.body` (a piece of the response body), `.end`,
  `.socket.message`, `.socket.closed`. The app makes up one id per request or WebSocket and
  registers its listener before the call, so nothing is missed. A tunnel belongs to the connection
  that opened it and ends with it.
  - **Flow control without loss.** `limitedOutput` (the Console's) drops output, which is right for
    a terminal and wrong for a byte stream. Instead the relay sends at most 1 MiB of a response body
    before the app acknowledges (`relay/ide.ack`) what it handed to the browser; the app takes the
    next piece from its queue only when the browser's read asks for it (a `ReadableStream` with
    high-water mark 0), so a slow browser holds the download back all the way to code-server's
    socket. Measured: a 512 MB download that nobody reads stalls with 7.8 MB produced
    (`e2e/ide/streaming.e2e.ts` asserts under 16 MB); closing the tab stops it. Cost: a stream
    cannot go faster than 1 MiB per round trip, about 20 MB/s at 50 ms.
  - **WebSockets** have no pause in Bun's client, so no window: messages go through as they come,
    and a side that is more than 32 MiB behind (relay: unread bytes on the link; app: the browser's
    buffered amount or queued sends) has its socket ended with 1013 or 1009 instead of dropping a
    message. Browser messages are sent on in order, one call each. Binary and text frames, the
    close code and the subprotocol are carried through.
  - Compressed responses pass as they are (`decompress: false`); hop-by-hop headers are removed
    both ways. **Cookies never cross:** cookies ignore ports, so the browser sends the IDE origin
    every cookie of every server on 127.0.0.1 (an agent's dev server, say), and the tunnel would
    carry them to a possibly remote host. `Cookie` and `Authorization` are dropped from requests
    and `Set-Cookie` from answers (code-server has no login with `--auth none`). Found by review;
    tested. `Host` and `Origin` are kept as the browser sent them, because code-server checks
    that they match.
- **Origin: a second listener on another loopback port (option 1).** `startIdeOrigin` binds
  `127.0.0.1:0` and serves only `/<ticket>/...`, proxied. A different port is a different origin,
  so a page from code-server (third-party code with full JavaScript, service workers and storage)
  is never same-origin with the app. The app's guard is not touched: it accepts only its own
  `Origin`, so the IDE's origin is refused on `/api` and on its pages with `forbidden-origin`, even
  with the token. Tested through the SDK (`e2e/ide/access.e2e.ts`) and in Chromium with a script
  served on the IDE's origin that calls `/api` and reads `/` (`e2e/browser/ide.e2e.ts`): every
  attempt is blocked.
  - **The ticket is in the path, not a cookie.** The task suggested a cookie on that origin. Cookies
    are not isolated by port (the reason `2026-11-22-local-server-security.md` rejects them for the
    token): a cookie would also be sent to every dev server an agent runs on 127.0.0.1. A path
    ticket works because code-server is designed to sit behind a reverse proxy that strips a path
    prefix (its pages use relative addresses). The ticket is 192 random bits, comes from the same
    store as preview tickets (`createPreviews`), one per session while it lives, expires after an
    hour unused (`previewLifetimeMs` sets both), is revoked when the session is archived (checked
    on every request) and lives in memory. `/<ticket>` redirects to `/<ticket>/`. Every other
    address answers the same bare 404.
  - Checks, in order: Host is the loopback name and this port (stops DNS rebinding); `Origin`, if
    present, is this origin; `Sec-Fetch-Site` is not another site (a navigation from the app's
    page, which is `same-site`, is allowed); the ticket is live and its session open; the
    workspace is connected (else 503 with the reason). Answers carry `Referrer-Policy:
    no-referrer` unless code-server sets its own, so the ticket does not leave in a Referer. The
    API refuses `POST /api/sessions/:id/ide` without the token like any call.
  - The UI opens the tab with `window.open("about:blank")` on the click, sets `opener = null`, and
    fills in the address when the app answered, so the IDE cannot steer the app's tab and a
    pop-up blocker sees a user gesture.
  - *Rejected: path-scoped under the app's origin.* Same-origin script could read the token tag in
    the app's page and call `/api`; nothing can make that safe.
  - *Rejected: a sandbox like the Preview's.* The workbench needs storage, service workers and
    WebSockets, which an opaque origin cannot have.
- **API and SDK.** `GET /api/sessions/:id/ide` answers `{available: true}` or `{available: false,
  reason}` (archived; workspace offline or removed; code-server not installed on "<label>" with the
  install command), `POST` starts it and answers `{url}` (409 `ide-unavailable` otherwise).
  `client.ide.ideStatus(id)` and `client.ide.openIde(id)`. The UI button is disabled with the
  reason as its title and description. It rechecks when the workspace state changes and when the
  window gets focus again. For an archived session the Changes pane shows its own message and no
  panel, so there is no button to disable there.

## Measured (local sshd on this machine, fake code-server)

Small request (the static file), sequentially: 3.6 ms through the local relay, 7.6 ms through the
ssh relay. Six at a time: 1.5 and 1.7 ms each. A 50 MB download: 0.97 s (52 MB/s) local, 1.96 s
(25 MB/s) over ssh. So the tunnel adds a few ms per request and about 25 MB/s on loopback ssh; on a
real network the round trip of the link decides: a workbench of a few hundred requests, six at a
time, at 50 ms is about two seconds plus the payload (some 15 MB, compressed). That is usable;
a link above 200 ms will feel slow, and per-stream throughput is capped at 1 MiB per round trip.
Not measured with the real workbench (below).

## Checked with the real code-server

`bun add code-server` into a temp folder (4.146.0, not a dependency of the repo): it prints
`4.146.0 <hash> with Code 1.146.0` for `--version` (the line detection parses), accepts `--socket`,
`--socket-mode 600`, `--auth none`, `--user-data-dir`, `--extensions-dir` and `--config`, logs `HTTP
server listening on <socket path>` and `Authentication is disabled`, and opens no TCP port. Its
workbench could not be run here: the npm package needs native modules built by its postinstall
(`kerberos` fails without a toolchain) and the bun install of it answers 500 (`Cannot find package
'@github/copilot-sdk'`). Through the tunnel the browser got exactly that 500, as a direct request on
the socket does. So **unverified with the real code-server: the workbench loading, its WebSockets
(reconnection token, extension host), its origin check behind the tunnel, and the path-prefix
handling.** Two small facts from the run: `--version` writes a default `~/.config/code-server/
config.yaml` when none exists, and code-server's own IPC socket lives in `--user-data-dir`, so that
path must stay under the 104 (macOS) or 108 bytes a unix socket address allows.

## Tests

A scripted `code-server` (`e2e/support/fake-code-server/`, a Bun script) takes the same flags,
listens on the socket it is given, serves a page, a static file, a streamed download, an echoing
upload, the request's headers, a cookie, an "attack" page and a WebSocket echo, and writes down how
it was started. It is selected with `AGENTCONTROL_CODE_SERVER_CMD`, locally and on the ssh host.
`e2e/ide/` (SDK level), `e2e/browser/ide.e2e.ts`, `e2e/workspaces/ssh-ide.e2e.ts` (real sshd).

## Not done

- A relay killed with SIGKILL (or a crash) leaves its code-servers running. Fix: a pid file per
  server and a sweep at relay start that checks the command line before killing.
- Dropping cookies is unverified with the real workbench (it should not need any without auth).
- The ticket's lifetime is renewed by HTTP requests and WebSocket upgrades only: a tab that holds
  only a WebSocket for an hour cannot reconnect and has to be opened again from the app.
- `code-server --version` runs on every status check (no cache) and writes a default config file in
  the home folder when there is none.
- Uploads over 16 MiB are refused (413); they are read whole before they are sent.
- macOS, an arm64 host and a high-latency link were not tried. The compiled app's smoke does not
  start a code-server.
