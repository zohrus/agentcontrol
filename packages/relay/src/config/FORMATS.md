# Native formats the config feature writes

Checked against the real CLIs bundled by the ACP adapters in `docs/acp-notes.md`: Claude Code
2.1.330 (`claude-agent-acp` 0.109.1) and Codex 0.171.0 (`codex-acp` 2.9.0), run on Linux with a
throwaway `HOME`. Official docs sites were not consulted: no entry below is "verified against docs".

Statuses: **ran** = the real CLI read a file in exactly the shape we write and showed the effect;
**assumed** = not observable without a model call or a login, taken from knowledge of the docs.

## How each thing was checked

- Claude Code: `claude -p --output-format stream-json` prints an `init` event (before any model
  call) listing `mcp_servers` (with source user/project), `skills`, `slash_commands` and
  `permissionMode`. `--debug-file` logs the permission rules loaded from `userSettings`. For
  CLAUDE.md, `env` and hooks, `ANTHROPIC_BASE_URL` pointed at a local fake API recorded the first
  request (it contained both CLAUDE.md files) and a `SessionStart` hook ran and saw the `env`
  value from settings.json. `claude mcp add` was also used to see what the CLI itself writes.
- Codex: `codex mcp list|get --json`, `codex debug prompt-input` (model-visible prompt: AGENTS.md
  files and the skills list), and `codex app-server` JSON-RPC `config/read`, `hooks/list` and
  `skills/list` (effective config, hook files with trust status, skills with scope).

## Claude Code

| What | File | Status |
|---|---|---|
| MCP, global | `~/.claude.json` key `mcpServers`: stdio `{type:"stdio",command,args,env}`, http `{type:"http",url,headers}` | ran (listed with source `user`; `claude mcp add` writes the same shape, also `type:"stdio"`) |
| MCP, repo | `<repo>/.mcp.json` key `mcpServers` | ran (source `project`); Claude Code asks the user to approve project servers on first use |
| Permission rules | `settings.json` `permissions.allow`, `permissions.deny` | ran (debug log: rules loaded for `userSettings`) |
| Permission mode | `settings.json` `permissions.defaultMode`: `default`, `acceptEdits`, `bypassPermissions` | ran (`permissionMode: acceptEdits` in init) |
| Env | `settings.json` `env` | ran (a hook saw the value) |
| Hooks | `settings.json` `hooks.<event>[]` of `{matcher?, hooks:[{type:"command",command}]}` | ran for `SessionStart` without matcher; `PreToolUse`, `PostToolUse`, `Stop` use the same schema; the `Edit\|Write\|MultiEdit` matcher is assumed |
| Instructions | `~/.claude/CLAUDE.md`, `<repo>/CLAUDE.md` | ran (both in the request body) |
| Skills | `<base>/.claude/skills/<name>/SKILL.md` | ran (init `skills`, home and repo) |
| Commands | `<base>/.claude/commands/<name>.md`, frontmatter `description` | ran (init `slash_commands`, home and repo) |

`<base>` is the home folder (global) or the repo. Subagents (`.claude/agents/*.md`) are not
written: the canonical model has no subagent item yet.
`~/.claude.json` is also Claude Code's own state file and is rewritten often; apply refuses if it
changed since the plan, so a plan can go stale. Re-plan then.

## Codex

| What | File | Status |
|---|---|---|
| MCP | `~/.codex/config.toml` `[mcp_servers.<name>]` with `command`, `args`, inline `env = {..}`; http: `url`, inline `http_headers = {..}` | ran (`codex mcp list --json` shows stdio env and streamable_http headers). `codex mcp add` itself writes `env` as a `[mcp_servers.<name>.env]` sub-table; both read the same |
| MCP, repo | `<repo>/.codex/config.toml` | ran, but only read when the repo is trusted (`[projects."<path>"] trust_level = "trusted"` in the user's config); we never set trust |
| Mode | top-level `approval_policy` + `sandbox_mode`: ask = on-request/read-only, auto-edit = on-request/workspace-write, full-auto = never/danger-full-access | ran (`config/read` returns them; an invalid value is rejected with the allowed list) |
| Allow/deny lists | none in config.toml. Codex has command rules in `rules/*.rules`, a different format not written yet | unsupported, reported with that reason |
| Env | `[shell_environment_policy.set]` (whole table owned by us) | ran (`config/read`) |
| Hooks | `<base>/.codex/hooks.json`, same shape as Claude's, events PreToolUse/PostToolUse/SessionStart/Stop | ran (`hooks/list`, source `user`). New hooks show `trustStatus: untrusted` until the user reviews them in Codex, so they do not run silently. Repo hooks.json was not loaded for an untrusted repo. The `apply_patch` matcher is assumed |
| Instructions | `~/.codex/AGENTS.md`, `<repo>/AGENTS.md` | ran (`debug prompt-input`) |
| Skills | `<base>/.agents/skills/<name>/SKILL.md`; `~/.codex/skills/` is also read | ran (`skills/list`: scope user and repo) |
| Commands | none: Codex 0.171 does not load `~/.codex/prompts/*.md` (not listed as skills or commands, no mention in the binary) | unsupported, reported with that reason. A command could be written as a skill later |

## Managed markers and the manifest

See `docs/decisions/0001-harness-config-ownership.md`. In short:

- `<homeDir>/.agentcontrol/managed.json` lists, per native file, the agent, the format and each
  owned entry (`key`, `itemId`, sha-256 of the entry as last written). Drift = the entry now read
  from disk hashes differently (`drift`) or is gone (`missing`). Drift covers every file in the
  manifest, repo files included.
- Markdown: `<!-- agentcontrol:begin <id> -->` ... `<!-- agentcontrol:end <id> -->`.
- JSON: entries are located by path. Hooks carry a ` # agentcontrol:<id>` shell comment at the end
  of the command so they can be found again. Allow/deny rules are owned one string at a time.
- Whole-file items (skills, commands) are owned entirely; hand-written files at those paths are
  never overwritten (reported as unsupported).
- Anything already at an entry's place that we did not write (for example an MCP server of the same
  name) is left alone and reported as unsupported.
- `${secret:NAME}` is written as is and listed in `needsSecret`.

## Editor limits

JSON: other keys and their order survive; whitespace is normalised to 2-space indent (inline
arrays get expanded, comments are not valid JSON anyway). Trailing newline kept as found.

TOML (line based, no parser): only `[table]` sections and top-level keys we own are touched.
Limits:
- A section ends at its last key/value line; trailing comments before the next header stay put.
- Sub-tables (`[mcp_servers.x.env]`) of a table we replace or remove are not touched: an MCP
  server hand-written with an `env` sub-table is treated as hand-written and left alone.
- Header-looking lines inside multi-line strings or arrays of arrays confuse the scanner.
- Quoted or dotted server names are unsupported (names are `[A-Za-z0-9_-]+`).
- CRLF files keep their CRLF on untouched lines; new lines are LF.
- Top-level keys go after the last top-level line, before the first table.
- Inspect reads only one-line values.

Markdown: removing a block leaves a final newline that a file without one did not have. A file the
app created and then emptied stays as an empty file.
