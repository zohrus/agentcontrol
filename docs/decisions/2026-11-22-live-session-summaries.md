# Live session summaries and workspace identity (2026-11-22)

Implements axes 11 and 12 (public part) of `docs/abstractions-review.md`.

## Decisions

- **The relay owns derived session state.** `relay/src/sessions/live-summaries.ts` folds each log
  once when the daemon starts (after crash recovery) and then applies every appended event with the
  same reducer table (`fold.ts`). `sessions.list`, session info, archive and the turn checks read
  memory; no hot path re-reads a log. `Sessions.events` still reads the log (history is history).
- **Summary fields added** (protocol, additive, defaulted so old parsers still work):
  `turnRunning` (turn open, agent alive, not archived; stays true while waiting for approval) and
  `pendingPermissions` (`requestId`, `options`, and a small agent-neutral `toolCall`: `title`,
  `kind?`, `command?`, `path?`).
- **Push.** `relay/sessions.changed { sessions }` goes to every client that called
  `relay/events.subscribe` (only the followed session for a single-session subscribe). Changes in
  one event-loop turn are coalesced into one push with one entry per session (`setImmediate` after
  the event is appended and applied; no timers). Events that carry no news (agent output) do not
  push, so `lastSeq` in a pushed summary is the seq at the time of the change, not the latest.
- **App.** Sync saves pushed summaries and republishes them; it lists once per (re)connect and
  after creating a session (read-your-write for the 201). A summary whose `lastSeq` is lower than
  the stored one is dropped, because a list answer and a push can be handled in either order.
- **Restart rule for pending requests.** A restart kills the agent, so an open request can never be
  answered. Recovery appends `agent-exited`, which clears `pendingPermissions` and `turnRunning`;
  the session reads `failed` (turn open) or `idle` (turn finished). The request stays in the log.
- **Workspace identity.** Every SSE message names its workspace: `event` is the event plus
  `workspaceId`, `sessions` rows carry `workspaceId`, `fs` is `{ workspaceId, sessionId, paths }`.
  The store keys sessions by `(workspace_id, id)` (migration 0001, hand-trimmed so its copy step
  only selects columns the old table has), events were already keyed so; `getSession` and
  `eventsAfter` take the workspace.
- **Phase 5 seam.** `app/src/api/routing.ts`: `linkForWorkspace` (workspace id to relay link) and
  `routeRequest` (which workspace a request goes to). Routes use only these; `main.ts` creates the
  one local workspace and passes the record to sync and the API.

## UI follow-up (not done here)

`packages/ui-template` should read `row.pendingPermissions[0]` for its row's Approve/Deny and
`row.turnRunning` for the working indicator instead of deriving them from events, and key sessions
by `(workspaceId, id)`.
