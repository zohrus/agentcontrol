# 0001: The app owns only the config entries it created

Status: accepted (phase 6, harness configuration)

## Decision

Agent Control writes into Claude Code's and Codex's own config files, but it owns only the entries
it created, never a whole file. The files are shared with the user, with the agents themselves and
with other tools (`~/.claude.json` is Claude Code's own state file and is rewritten often).

- **Marked entries.** Markdown (`CLAUDE.md`, `AGENTS.md`): a block between
  `<!-- agentcontrol:begin <id> -->` and `<!-- agentcontrol:end <id> -->`. JSON: one key path
  (an MCP server, one permission string, one env variable), and hooks carry a trailing
  `# agentcontrol:<id>` in their command. TOML: one `[table]` or one top-level key.
- **Whole files only where the item is a file.** A skill folder or a command file is owned
  entirely, but only when the app created it. A hand-written file at that path is never replaced.
- **Manifest.** `<home>/.agentcontrol/managed.json` lists, per native file, each owned entry with
  the hash of what the app last wrote. It is the source of truth for "ours".
- **Hand-written wins.** If something we did not write already sits at an entry's place (an MCP
  server of the same name), it is left alone and the plan reports the item as unsupported.
- **Drift.** An owned entry whose hash differs from the manifest was edited by hand: reported as
  drift, never overwritten silently. Re-applying is the user's choice.
- **Removal.** An item removed in the app is removed from the files, but only the entries the
  manifest lists. Everything else in the file stays.
- **Safety.** Apply always shows a plan first (every file's before and after), backs every file up,
  writes through a temporary file, and can be rolled back byte for byte. Apply is refused if a
  file changed after the plan was made.
- **Where.** The relay writes under the user's real home by default; `AGENTCONTROL_CONFIG_HOME`
  overrides it (tests always set it). The canonical items live in the app's SQLite file.

## Why

A whole-file owner destroys what the user wrote and fights the agents that also write the file.
Marked entries make every change small, explainable in a plan, reversible, and safe to repeat.
