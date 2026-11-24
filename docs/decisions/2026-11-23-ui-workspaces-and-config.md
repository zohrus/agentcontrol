# Workspace and Config screens in the default UI (2026-11-23)

## Decisions

- **A session is `(workspaceId, id)` in the UI.** The data layer keys events, usage, diffs, trees
  and files by `keyOf(ref)`; the list, selection and archive flow carry a `SessionRef`. The URL hash
  is `#/sessions/<workspace>/<id>`; the older `#/sessions/<id>` still opens a session on this Mac.
  The API still finds a session by id alone (`findSessions`, first match). That is safe in practice:
  the relay makes every session id with `crypto.randomUUID()` (`sessions/index.ts`,
  `sessions/directory.ts`), never taking one from an agent, so two workspaces cannot share an id
  (122 random bits). Decided to leave the routes as they are; if a relay ever made ids another way,
  the session routes would need `?workspace=` and the UI would pass it.
- **Workspaces menu, not Config.** "Config" now opens harness configuration. Workspace setup
  (the checklist and per-repo worktree setup) is "Check and repair" in the Workspaces menu, next to
  Add workspace, Restart relay (only when the relay needs an update, after a warning) and Remove.
- **Add workspace shows each step as it happens** (24 Nov 2026). `workspaces.add({ requestId })`
  and `workspaces.check(id, { requestId })` publish `workspace-progress` messages on the live
  stream (`WorkspaceProgress` in `protocol/src/workspaces/progress.ts`: `requestId`, optional
  `workspaceId`, `step`, `label`, `state` started/ok/failed, plain `message`; the SDK has
  `onWorkspaceProgress`). Without a `requestId` nothing is published. Step ids are the checklist's:
  `connect`, `platform`, `install`, `relay`, then `agents` (the relay's own checks as one step, so
  its failure names the first failing check) and `repos`. `add` reports connect, platform, install
  and relay itself (the host steps now run before the connection is started, so the connector finds
  the relay installed); a host that cannot be reached stops there, the workspace is saved offline
  with the reason, and the dialog shows the failed step with Retry without running the checklist
  again. Otherwise the dialog runs `check` with the same request id; a step that already passed is
  not shown as running again. Retry runs `check`, which repeats every step. The relay's own checks
  arrive as one `agents` step, not one message per check. Local `workspace.check()` has no progress.
- **Removed workspaces' sessions share one "Removed" group**, read-only, each row saying which
  workspace it came from. An offline or reconnecting workspace keeps its own group, showing its
  state and reason; its sessions are read-only and the composer says why.
- **Config items are saved at once, files only after review.** Add, edit, delete and on/off call
  `config.save` (app database only). Nothing reaches an agent's files except through Review changes
  and Apply. "Write to" chooses which agents a review covers; items themselves have no per-agent
  switch (the protocol has none), so "which agents get it" is shown as the plan's `unsupported`
  reasons next to each item once a review has been made.
- **Agent of a file change** is judged from its path (`.codex/`, `.agents/`, `AGENTS.md` are Codex),
  because `ConfigFileChange` carries no agent.
- **Drift.** "Overwrite" and "Write it again" open the review (the plan rewrites the entry).
  "Keep my manual edit" imports that agent's current files, takes the matching items' contents
  (same id, or same kind and name), saves them and opens the review, which shows what the other
  agent would now get. Apply with nothing to write records the files as up to date.
- `loadWorkspaces` replaces the list: a workspace the app no longer returns leaves the menu.
  "Keep my manual edit" says "None of those items could be found in the agent's files any more, so
  nothing was kept." when the files hold none of the items, and changes nothing. Opening Config
  loads items and drift together.
- **A review covers every scope that has items** (24 Nov 2026). `relay/config.plan` and `config.plan`
  take `repoPaths` besides `repoPath`: one plan speaks for the global files and every repository
  named, so Apply is one write with one backup (all or nothing, a file that moved anywhere refuses
  the whole apply as stale) and Undo is one rollback. Separate plans per scope could not be applied
  one after the other (the first apply changes the manifest, so the second is stale). The UI names
  every repository that has an item and groups the review by scope ("All repositories", "Only in
  <path>"), then by agent; a file belongs to the repository whose folder holds it. A repository
  whose items were all deleted is no longer named, so entries written there earlier stay until an
  item brings it back (in `TASKS.md`).
