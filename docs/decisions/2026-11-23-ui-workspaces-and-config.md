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
- **Add workspace has no live progress.** `workspaces.add` and `workspaces.check` answer once, so
  the dialog shows "connecting", then "checking", then the checklist. A step that fails is named
  with its detail and Retry runs the checklist again (which also installs a missing relay).
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
- A review covers one repository: that of the first repo-scoped item.
