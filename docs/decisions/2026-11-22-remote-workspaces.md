# Remote workspaces over ssh (2026-11-22)

Phase 5. Implements axes 1 and 12 of `docs/abstractions-review.md`. The relay is the same code
locally and on a host; only the way the app reaches it differs.

## Decisions

- **`WorkspaceTarget`** (`app/src/relays/target.ts`), two kinds, no plugin mechanism: `local` and
  `ssh`. `bridgeCommand()` is the argv that runs `<relay> --stdio --data-dir <dir>` on the machine;
  `inspect()`, `isInstalled()`, `install(binary)`, `forwardPort(port)`, `stopRelay()` and
  `explainFailure(stderr)` are the rest. `connectRelay` is `relayClientOver(spawnBridge({ argv }))`
  for both kinds, so framing, reconnect and resume are shared.
- **ssh is the system `ssh`**, so `~/.ssh/config`, keys, agents and jump hosts work. Every call
  uses `BatchMode=yes` (never prompts), `ServerAliveInterval=5` with `ServerAliveCountMax=3` (a dead
  link is noticed in about 15 s) and `ConnectTimeout=10`. A host that is not an alias or `user@host`
  (leading dash, spaces, quotes) is refused so it cannot be read as an ssh option. ControlMaster is
  **not** used: each call costs one ssh handshake (about 250 ms here) and connection sharing adds a
  failure mode (stale master sockets) that the tests cannot prove away.
- **Files on the host** live under `~/.agentcontrol/`: the relay binary of the app's exact version at
  `relay/<version>/agentcontrol-relay`, and the relay's data (socket, pid, session logs, worktrees)
  at `relay-data/`. Install copies with `ssh host 'mkdir -p ... && cat > part && chmod && mv'`
  (atomic rename) and skips the copy when `sha256sum` already matches, so it is idempotent. It is
  done on connect only when the versioned binary is missing; "Check and repair" runs the checksum.
- **Plain-language failures.** The bridge's stderr is kept and turned into a reason (`could not
  resolve`, `refused`, `timed out`, `host key`, `permission denied`), stored as the workspace's
  `reason`.

## Version rule

One relay daemon per data dir. The app checks `relay/hello` against `VERSION` (the
`packages/protocol/package.json` version, which the build requires to equal the root one; `protocol/src/version/`, one constant for app and relay). On a mismatch:

1. `sessions.list` on the old daemon (read only). If no session has a running turn or a pending
   permission, the app runs `<binary of this version> stop --data-dir ...` over ssh (`relay stop`
   reports and exits non-zero on failure, which fails the replacement) and reconnects at once; the
   new bridge starts a daemon of the new version. Nothing was running, so nothing is lost.
2. Otherwise the relay is used as it is and the workspace is `needs-relay-update`, with a reason
   naming how many sessions are working and the relay's version (`relayVersion`).
   `POST /api/workspaces/:id/restart-relay` replaces it when the user chooses (its agents end).

For the local workspace the same applies when `AppOptions.stopLocalRelay` is given (main.ts gives
it); without it the mismatch is only reported. `AGENTCONTROL_RELAY_VERSION` overrides what a relay
process reports, for tests only (an older release is simulated by a binary that sets it).
`/api/workspace` (this Mac or `?workspace=`) and `workspaces.list()` are the same `WorkspaceInfo`.

## A relay that starts while the old one is stopping (24 Nov 2026)

Replacing a relay races with its own shutdown: the old daemon stops listening first, ends its
agents and clients, and removes `relay.sock` and `relay.pid` as its last act, while the app's
reconnect (or a bridge) may already start a new daemon on the same data folder. The new one made
its own socket and pid file, and the old one then deleted them. A new daemon now waits (up to 10 s)
for the process named in a leftover `relay.pid` to be gone before it claims the socket
(`relay/src/daemon/stopping.ts`). Tested with a real old daemon kept busy by a client that does not
hang up (`e2e/sessions/relay-replaced-while-stopping.e2e.ts`). The flaky "restart a busy old relay"
test itself failed for a separate reason in its helper: the daemon's socket file exists a moment
before it accepts connections, and the helper treated the file as proof, then hung on a refused
connection. `startOldRelayOnHost` now waits for an accepted connection. With the fix, 24 runs in
parallel on 4 cores all passed (14 of 14 and 10 of 10), where 2 to 4 of 14 had hung before.

## Agents on a host

A non-interactive ssh session has a minimal PATH. On connect the app reads the user's login-shell
PATH (`$SHELL -lc`) once and starts the relay with `env PATH=...`, so a daemon started by that
bridge finds agents installed by npm, nvm or `~/.local/bin`. A daemon that was already running keeps
the PATH it had.

## Multi-workspace

- `app/src/workspaces/` holds one sync per workspace (`registry.ts`), the ssh actions
  (`ssh-workspaces.ts`) and the checklist (`check.ts`, `ssh-check.ts`). `startApp` only waits for the
  local relay; saved ssh workspaces reconnect in the background, so an unreachable host never blocks
  the app or another workspace.
- Connection state: `connecting`, `connected`, `reconnecting` (a connection that was working
  dropped), `offline` (the last attempt failed; `reason`), `needs-relay-update`, `removed`. It is
  runtime state in the workspace record the API returns, pushed as the SSE `workspace` message.
  Backoff doubles from 100 ms to 15 s for ssh (3 s local).
- `api/routing.ts` is the only place that turns an id into a link: a session id is looked up in the
  store (`findSessions`), a request without a session takes `?workspace=<id>` (default `local`).
  A workspace that is not connected answers 503 `relay-unavailable` with the reason; a removed one
  answers 409 `workspace-removed`. Reads (list, session, events) always come from the store.
- Removing a workspace stops its sync and sets `removed_at` (migration 0004); its sessions and
  events stay readable. The host is not touched: its relay keeps running.

## Console access later (`relay/terminal.*`)

A terminal stream is another set of relay methods on the same stdio channel, so it needs no new
transport: `terminal.open { cwd }` returns a terminal id, `relay/terminal.output` notifications carry
bytes (base64) and `terminal.input` / `terminal.resize` / `terminal.close` are calls. The sync link
already forwards a notification type to the hub (`fs.changed`); terminal output would do the same
without being stored. `forwardPort` covers the browser IDE and dev-server preview, which cannot
use the stdio channel.

## Tests

`e2e/workspaces/` runs the whole app against a **real private sshd** started by
`e2e/support/setup/ssh-host.ts` as the current user: its own host key and client key, a throwaway
`HOME` (`SetEnv HOME=` in its config, so `~/.agentcontrol` is the host's own), a generated ssh config
passed with `-F` (`AppOptions.ssh.configFile`) and a TCP proxy in front of it that a test can cut
(`drops`) or take down (`goesDown`). The relay "binary" the app installs is a small script that runs
the checkout's relay with the host's environment, so no compile is needed. Needs `sshd` and
`/run/sshd` (CI installs `openssh-server`). One test compiles the real relay (`bun build
--compile`) for the test machine and installs that binary over ssh.
