# Docs

- [plan.html](plan.html): the full plan, with the reasons behind each decision. Read the relevant section before an architecture change.
- [status.html](status.html): the status of every component, updated as work lands.
- [releasing.md](releasing.md): how to cut a release, the secrets it needs, and what has not been verified on a Mac.
- [acp-notes.md](acp-notes.md): what the real Claude Code and Codex adapters send over ACP, from the Phase 0 spike.
- [brief-template.md](brief-template.md): the template for briefing a coding agent.
- [abstractions-review.md](abstractions-review.md): where change is expected and whether the seams for it exist.
- [dev-loop-review.md](dev-loop-review.md): how to iterate fast without breaking `main`.
- [landings.log](landings.log): one line for each change that `bun run integrate` pushed to `main`.
- [decisions/](decisions/README.md): one short file per decision others live with (format in its README).
  - [0001-dev-loop.md](decisions/0001-dev-loop.md): how the development loop works.
  - [0001-harness-config-ownership.md](decisions/0001-harness-config-ownership.md): the app owns only the config entries it created.
  - [2026-11-22-duplication-threshold-zero.md](decisions/2026-11-22-duplication-threshold-zero.md): any duplicated block fails the build.
  - [2026-11-22-live-session-summaries.md](decisions/2026-11-22-live-session-summaries.md): the relay owns derived session state.
  - [2026-11-22-local-server-security.md](decisions/2026-11-22-local-server-security.md): host, origin and token checks on the local server.
  - [2026-11-22-normalised-agent-updates.md](decisions/2026-11-22-normalised-agent-updates.md): the UI reads normalised updates, not raw ACP.
  - [modify-directory-sessions.md](decisions/modify-directory-sessions.md): how the Modify agent runs as a directory session.
- Images: `ui-live-light.png`, `ui-live-dark.png` (the default UI in two themes) and `ui-preview.png`.
