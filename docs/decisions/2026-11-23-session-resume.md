# 2026-11-23 Resume after a relay restart: an `interrupted` status and `relay/sessions.resume`

Date: 2026-11-23   Author: relay agent (resume)

## Context

When the relay stopped (crash, reboot, update) the agents died with it. The session read as `idle`
(or `failed` if a turn was open) and a new prompt failed with "This session's agent is not running."
`docs/acp-notes.md` records that a new adapter process can `session/load` the old agent session id
(cwd = the worktree), that the replay is coalesced, and that the next turn remembers the work.

## Decision

- **Interrupted.** A session whose agent was alive when the relay stopped gets an
  `agent-interrupted` event `{ droppedRequests }` and reads `interrupted` (new `SessionStatus`).
  Two paths append it with the same function: a graceful stop (`shutdown`, after the agents were
  stopped and their last messages written) and recovery at the next start, for a relay that died
  (the log's last lifecycle event is `agent-started`). Requests the agent was waiting on are
  answered as cancelled in the log (`permission-answered` with `automatic.reason` "the relay
  stopped") and counted in the event, so the log says what was dropped. The open turn is closed
  (`turnRunning` false). An agent that had exited by itself before keeps its reading (`failed` or
  `idle`): only live agents are interrupted.
- **Resume.** `relay/sessions.resume { sessionId }` returns `{ contextRestored }`. It starts a
  fresh adapter in the same worktree, with the same port block and permission handling as a
  normal session, then:
  - if the agent advertises `loadSession` it calls `session/load` with the id stored in the last
    `agent-started` event (`agentSessionId`, new optional payload field) and the worktree as cwd;
  - else, or when loading fails, it starts a new agent session (`session/new`).
  It records `agent-started` and then `session-resumed { contextRestored, note }`. The note is a
  plain sentence: the agent remembers the work, or "Earlier context was not restored: <why>. The
  agent starts a fresh conversation in the same folder." The UI shows it as a muted line.
- **Replay is not logged.** While `session/load` is open, `session/update` notifications from the
  agent are not passed to the log: the log already holds the live messages, and the replay is
  coalesced (see `docs/acp-notes.md`). The `initialize` and `session/load` messages themselves are
  logged like any others.
- **Prompting an interrupted session resumes it first.** `relay/prompt` resumes when the status is
  `interrupted`; two requests at once share one start (`ctx.resuming`).
- **Refusals** (plain messages): unknown session (`sessionNotFound`), archived (`sessionArchived`),
  agent already running, not interrupted, and Modify (directory) sessions, which cannot be
  resumed because the fence's policy is not in the log: ask again.
- **App, SDK, UI.** `POST /api/sessions/:id/resume` and `sdk.sessions.resume(id)`. The status dot
  of an interrupted session reads like "waiting". Above the composer a banner says "Interrupted"
  with a Resume button (replying also resumes); `agent-interrupted` ends a Modify turn like
  `agent-exited` does.
- **Mock agent.** `canLoadEarlierSession(history)` makes it advertise `loadSession`, replay the
  history on `session/load` and accept only its own session id; `failsToLoadEarlierSession()`
  makes the load fail.

## Rejected

- **`session/resume`** (ACP, no replay): not advertised by the mock, and `session/load` is what
  was checked with the real adapter. The replay is cheap to hide.
- **Marking interrupted at startup only** (agent-exited at shutdown, no marker): a graceful stop
  records `agent-exited` for every agent, so the next start could not tell a stop by the relay from
  a stop by the user (archive) or a crash of the agent.
- **A new status for `agent-exited` by signal**: signals do not say who sent them.
- **Resuming failed or idle sessions too**: nothing says their conversation can be loaded, and the
  user chose to stop or the agent crashed; the plain message stays.
- **Storing the permission policy for Modify sessions** to resume them: the Modify flow starts a
  new session per request anyway.

## Not checked

- A real `session/load` through this code path with Claude Code (checked by hand earlier with the
  probe in `scripts/real-agent/resume-probe.ts`, not through the relay) and none with Codex (its
  adapter advertises `loadSession`; its replay shape has not been seen).
