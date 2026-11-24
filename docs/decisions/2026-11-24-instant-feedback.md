# Every action shows its result at once

Date: 24 Nov 2026. Status: decided.

The owner used the app with a real Claude Code agent: a second message "was super slow to appear",
and creating a session was slow as well. Rule from now on: **every user action produces a visible
result in the UI at once (target 100 ms, measured in the browser), whatever the relay, git, the
network or the agent are doing.** Slow work shows as progress on something already on screen; it
never delays the first reaction.

## How it was measured

`e2e/support/browser/reaction.ts` times, inside the page, from the user's first input (pointer or
key, seen in the capture phase of `window`) to the first mutation after which a page expression is
true. `expectPageToReactAtOnce` prints it as `REACTION | <action> | <ms>`.

The slow back ends are injected, never slept on:

- `aRelayThatIsSlowToAnswer(...methods)` (`e2e/support/setup/slow-relay.ts`) wraps the app's
  connection to the relay and holds the requests with those methods until `answers()` (or answers
  them with `refuses(message)`).
- `givesTheRepoARemoteThatHangs(repoPath)` (`hung-remote.ts`): `origin` is reached through
  `core.sshCommand`, a script that waits for a file; `ls-remote` and `fetch` hang until `answers()`.
- A slow setup script already existed (`slow-setup.ts`); the mock agent can now start slowly
  (`startsWhenFileExists`) or hold a turn (`willWaitForFile`).

The assertion in each test is that the reaction is visible **while the back end is still held**, so
no wall-clock threshold is involved and nothing flakes under load. `REACTION_BACKEND_MS=2000` makes
a test release its back end 2 s after the action, which gives the numbers below: an interface that
waits for the back end reads about 2000 ms, one that does not reads a few milliseconds.

## Numbers (headless Chromium on a shared Linux box, ms, back end answering after 2000 ms)

| Action | Before | After | What shows now |
|---|---|---|---|
| Create session (remote hangs, setup slow) | 2141 (a real hang: up to 30 s) | 37 | the session is listed, open, message box usable, "starting" |
| Send a message (relay slow) | 1938 | 6 | the bubble, "Sending…" |
| Allow / Deny a permission (relay slow) | 1941 | 33 | "Sending “Allow” to the agent…", buttons locked |
| Cancel a turn | 1960 | 25 | "Cancelling…" |
| Archive (confirm) | 2028 | 27 | "Archiving…" on the button and in the list row |
| Resume an interrupted session | 2029 | 17 | "Resuming…" |
| Save in the editor | never (nothing is shown) | 30 | "Saving…" next to the file name |
| Config: Review changes | 2045 | 4 | "Reviewing…" |
| Config: Apply | 1981 | 3 | "Applying…" |
| Config: Undo this apply | 2080 | 7 | "Undoing…" |
| Modify: send a request | 456 | 30 | the request in the chat |
| Modify: Keep | 37 | 31 | "Keeping…" (before, nothing between press and done) |
| Switch session, open a tab, open Workspaces, Config, Analytics, close with Escape | 7 to 155 | 11 to 155 | unchanged: these need no back end |

Not measured (no cheap way to hold their back end, or not built): Add workspace steps and Check and
repair (need an ssh host; the checklist already shows "running" at once), Analytics filters, and
search (⌘K): the search box in the top bar is only a placeholder, nothing opens.

## Real causes found, not only presentation

1. **Session creation waited for git.** `relay/sessions.create` resolved the latest trunk
   (`ls-remote`, `fetch`, 15 s each), made the worktree, and only then recorded `session-created`.
   Now it records `session-created` first (a quick check of a named base branch aside) and returns.
   The rest runs in the background and shows as events of the session: "Finding the latest trunk…",
   "Started from the latest origin/main.", "Creating the worktree…", then the setup script and the
   agent. A new `base-resolved` event records the base once known (`baseBranch` is "" until then);
   the fold updates the session's location and summary from it. A failure to make the worktree is a
   failed setup (status `waiting`, reason `setup-failed`), not a failed create. Archiving, a
   terminal and the file watch wait for the worktree (`SessionContext.creating`) instead of finding
   it missing; the Changes tab reads an empty diff and tree until it exists.
2. **The UI waited for two round trips before opening a new session** (`POST /api/sessions`, then a
   full `GET /api/sessions`). The UI now chooses the session id (`sessionId` is an optional
   parameter of `relay/sessions.create`, `POST /api/sessions` and `sdk.sessions.start`), lists a
   "starting" row and opens it in the same call, and fills the history in when the app answers.
3. **A sent message appeared only when its `prompt-sent` event came back** through relay, app and
   stream. It is now in the conversation at once and is replaced by the history's own copy.

## The shared pieces

- `ui-template/src/data/pending.ts`: the store's `pending` part. `whileBusy` marks an action as in
  flight, ignores a second press of it, and always clears the mark. Used for cancel, archive,
  resume, permission answers and the Modify actions; the list rows and the session view read it.
- Outgoing messages (`data/outgoing.ts`): `sending`, `sent`, `failed` with the reason. A
  `prompt-sent` event with the same text removes the oldest matching one in the same store update
  that adds the event, so there is never a second copy. A failed message stays, with "Send again"
  and "Remove", so its text is never lost.
- Optimistic session (`data/start-session.ts`): the placeholder row and `pending.creating` (no
  history is fetched for a session the app has not taken). If the app refuses, the row goes, the
  address is cleared and the reason is shown as a message.
- `components/use-working.ts`: for a button of a dialog whose work is local to it (Config review,
  apply, undo, import). It says what it is doing and does nothing when pressed again.
- Saving in the editor counts the saves in flight, so overlapping saves keep "Saving…" until the
  last one is answered.

## What stays slow, and why

- Everything that really needs the relay (the first diff of a session, a terminal's first prompt on
  a remote host) still takes the relay's time; the pane shows "Loading changes…" and the previous
  content meanwhile.
- A message to an interrupted session resumes the agent first (seconds with a real agent); the
  bubble shows "Sending…" for that time.
- The stream is re-reduced from all events at each batch (22 ms for 6600 events measured with Bun,
  not measured in the browser). See `TASKS.md`.
