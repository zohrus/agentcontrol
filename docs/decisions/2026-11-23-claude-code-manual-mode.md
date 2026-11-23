# Claude Code runs in Manual mode, or does not start
Date: 2026-11-23   Author: Claude (real-agent smoke task)

## Context
The first run of the real Claude Code adapter through the relay showed that it starts in the permission
mode the user's own Claude settings pick (`auto` on the test machine). In `auto` the agent edits files
and runs commands without ever asking, so no session could be "waiting on the user", and the Modify
agent's fence (which works by answering permission requests) never saw an edit.

## Decision
- Right after `session/new` the relay sends `session/set_mode` with `default` ("Manual") to every
  `claude-code` agent that offers that mode and is not in it (`packages/relay/src/agents/modes.ts`).
  Other agents keep the mode they start in.
- If the adapter refuses the switch, the agent does not start. The session records why, naming the
  mode and the user's own Claude settings as the likely cause. A session that cannot ask before it
  acts would look safe and not be, so failing loudly is preferred to starting it quietly.
- If the adapter does not offer `default` at all, nothing is switched (a future adapter may rename
  it). This is silent today; revisit if an adapter does it.

## Rejected
Starting the session anyway with a notice (the user may not read it, and every edit would go through
unasked); asking the user to switch modes in Claude's own settings (the app would then depend on
settings outside it).

## Consequences
Read-only commands (`ls`) and the read tools still run without a request, so "waiting on you" only
appears for edits and commands that change something. Users who want Claude's `auto` mode for their
own sessions have no way to ask for it yet; that would be a per-session setting later.
