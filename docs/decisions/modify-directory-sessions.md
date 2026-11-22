# Modify agent runs as a directory session

- `relay/sessions.create` takes a second shape, `{ kind: "directory", agent, cwd, prompt, permissionPolicy: { allowEditsUnder } }`.
  The worktree shape is unchanged. `SessionSummary.kind` and the `session-created` payload carry `"worktree" | "directory"`
  (absent means worktree). `GET /api/sessions` and the SSE `sessions` message leave directory sessions out; read one by id.
- The relay, not the agent, answers every permission request of a directory session: only a file edit whose paths all
  resolve (symlinks followed, a link that leads nowhere counts as outside) inside `allowEditsUnder` is allowed (`allow_once`);
  everything else gets the reject option, or a cancel. Both events are logged; `permission-answered` carries
  `automatic: { reason }`.
- Launch-time limits are sent as `_meta` of `session/new`. Claude (claude-agent-acp 0.109.1, read in its source):
  `claudeCode.options.tools` (only Read, Glob, Grep, Write, Edit, MultiEdit), `disallowedTools` (Bash, WebFetch, ...),
  `allowDangerouslySkipPermissions: false`. Not tested against a real adapter. Codex gets nothing: the relay policy is its only fence.
- The relay's folder operations sit behind `Workdir` (`relay/src/workdirs/`): `worktree` (git) and `directory` (no git:
  nothing to remove, no diff, tree and read from the folder).
- The app asks the Modify agent through `packages/app/src/modify/`; `/_safe` is served by the app and needs neither the
  UI folder nor the SDK. Known gap: the API has no Origin/Host check, so a web page could POST to the local API.
