# A session is created first, the prompt is written in it

Date: 24 Nov 2026. Status: decided.

## Decision

The New session dialog asks for the repository, the agent and an optional base branch, and its
button reads "Create session". It no longer asks for a prompt. The session opens at once; its
worktree is made, the setup runs and the agent adapter is started, all without a turn. The user
writes the first prompt in the session's message box.

## Contract

- `relay/sessions.create` and `POST /api/sessions`: `prompt` is optional for a worktree session. A
  request with a prompt behaves exactly as before (the agent gets it as the first turn). The
  Modify (directory) session still needs one.
- New session status `ready`: the agent is up, no prompt has been sent, nothing runs. It is not
  `running` and it is not `waiting`: the Inbox, the status bar and the menu bar count (the Swift
  poller counts only `waiting` and `interrupted`) leave it out. The list shows "<agent> · ready".
- Title: `session-created` keeps the title it was given (or the first line of the prompt at create,
  as before). Without either it is stored as "" and the summary reads "<repository folder> – new
  session" until the first `prompt-sent`, then the first line of that prompt (80 characters).
  Nothing is renamed by an event: the title is derived from the fold, so old logs read the same.
- Analytics: working time is prompt-sent to turn-end and waiting time is a permission request open;
  neither runs before the first prompt, so the time before it is neither (checked, no change).

## A prompt written before the session is ready

Held in the message box, not sent. While the status is `starting` Send holds the text (the box is
read-only, "Queued: it is sent as the first message as soon as the session is ready", with a
"Take back" button). When the status becomes `ready` it is sent as the first turn. When the
session does not become ready (setup failed) the text is not sent and stays in the box with
"Not sent: the session could not be set up." Nothing is lost and nothing is sent twice.
The relay itself does not queue: a `prompt` call on a `starting` session is refused with
"This session is still being set up: send the message again once it is ready." API clients wait
for `ready` (or pass the prompt in `create`).

## Why the agent starts at creation

So that a later task can read the agent's modes and models before the first prompt, and so the first
prompt starts the turn without waiting for an adapter to boot.
