# AgentControl: tasks for later

Items we found while reviewing the plan (22 Nov 2026) and chose not to put in it yet.
Each one should become a plan change, a roadmap task, or a decision when its time comes.

## Before the repository exists
- [x] Create the GitHub repo (`zohrus/agentcontrol`), then commit the plan as `docs/plan.html`.
- [x] Update the handoff `CLAUDE.md`: working name (AgentControl), macOS only, MIT, MVP roadmap, git-based UI updates, quality rules and dependency list. Then turn it into `AGENTS.md` plus a one-line `CLAUDE.md` that imports it.
- [ ] Final name. "AgentControl" / `agentcontrol` is a working name only ("Agent Control" is taken). Ideas so far: AgentZ, Hill Sphere / Hill, Minimoon, Saturn, Constellation, AgentOrbit.
- [ ] Before the first public release: rename everywhere (`@agentcontrol/sdk`, `~/.agentcontrol/`, `AGENTCONTROL_PORT_BASE`, `AgentControl.dmg`, cask), then claim the npm scope, Homebrew cask name and a domain.

## Security (deferred)
- [ ] Lock down the local server: listen on `127.0.0.1` only, require a random token generated at startup, check `Origin` and `Host` headers (blocks attacks from websites open in the browser, including DNS rebinding).
- [ ] Relay socket on shared workspaces: readable only by the owner (`0600`), so other users on the machine can't drive your agents.

## Sessions and git
- [ ] How work leaves a worktree: commit, push the branch, open a PR (with `gh`), then archive.
- [ ] Sessions started outside the app (`claude` run in a terminal): show them (e.g. via hooks, as Emdash does) or ignore them.
- [ ] Previewing an agent's dev server: forward its port over SSH and open it from the session.
- [ ] Prompt input: images, `@file` references, slash commands. Check which of these pass through ACP.

## Workspaces and the relay
- [ ] Disk growth: retention and archiving for JSONL event logs, cleanup of old branches left by archived sessions.
- [ ] Relay start-up on servers without user services after logout: fallback to `nohup` or tmux.
- [ ] Decide whether Mac machines are supported as remote workspaces.
- [ ] Workspace reboot: agent processes die and not every adapter supports `session/load`. Decide what the user sees and whether sessions can be resumed.

## Testing
- [ ] Keep the mock ACP agent faithful: record real Claude Code and Codex sessions during the spike and replay them in tests.
- [ ] Scripted Modify agent for end-to-end tests, making predictable UI edits.

## App robustness
- [ ] Long sessions: list virtualization and batching of streamed chunks so the browser doesn't stall.
- [ ] App upgrades: database migrations, a backup of `state.db` before each update, compatibility of old JSONL logs.
- [ ] Diagnostics: app and relay logs, a "copy diagnostics" button for bug reports.
- [ ] Write down the telemetry policy (proposed: none).

## Analytics
- [ ] Subscription users (Claude Pro/Max, ChatGPT) have no dollar cost: show usage against plan limits instead.

## Decisions made
- [x] Laptop platform: macOS only.
- [x] License: MIT. Add the `LICENSE` file when the repo is created.
- [x] Merge style: no pull requests. Claude pushes straight to `main` and keeps `docs/status.html` up to date.

## To verify in Step 1
- [ ] typescript-eslint supports TypeScript 7.x; otherwise pin the TypeScript version it supports.
- [ ] Bun's `minimumReleaseAge` install setting exists and works as expected.
