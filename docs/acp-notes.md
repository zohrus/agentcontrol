# ACP notes for the relay

Findings from the Phase 0 spike (`spike/log-acp-events.ts`), the SDK type definitions and the two adapters.
Versions: `@agentclientprotocol/sdk` 2.9.1 (ACP protocol version 1), `claude-agent-acp` 0.109.1, `codex-acp` 2.9.0.
"Confirmed" means seen in a real log; "from types" means read from the code only.

## SDK client API (stable entry `@agentclientprotocol/sdk`)

- Build a client with `client({ name })`, a `ClientApp`. Register handlers, then `connect(stream)`, which returns a
  `ClientConnection` with `.agent` (a `ClientContext`), `.closed`, `.signal` and `.close()`.
- `onRequest(methods.client.session.requestPermission, ({ params, signal }) => response)` answers agent-to-client requests.
  `onNotification(methods.client.session.update, ({ params }) => ...)` gets `session/update`
  (`params.sessionId`, `params.update.sessionUpdate`). `"*"` registers a catch-all for either kind.
- Methods are sent with `conn.agent.request(methods.agent.session.prompt, params)`. The method name types the params and the result.
  Notifications go through `conn.agent.notify(methods.agent.session.cancel, { sessionId })`.
- `methods` constants: `initialize`, `authenticate`, `logout`, `session.{new,load,list,delete,resume,close,setMode,setConfigOption,prompt,cancel}`.
  There is no `session/set_model` in the SDK. Use `session/set_config_option` with the option of category `model`.
- Stream from a child process: `ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout))`. A `Stream` is
  `{ readable, writable }` of parsed JSON-RPC messages, so wrapping it in a `TransformStream` (see `spike/message-log.ts`)
  is how the relay can log every raw message unchanged.
- `session/prompt` stays open for the whole turn and resolves with `{ stopReason, usage?, _meta? }`. Updates arrive as
  notifications while it is open. `session/cancel` is a notification; the open prompt then resolves with `cancelled`.
- `set_mode`: `{ sessionId, modeId }`. `set_config_option`: `{ sessionId, configId, value }` (boolean options use
  `{ type: "boolean", value }`). The adapter answers `set_config_option` with the full config list.
- `buildSession(cwd).start()` and `ActiveSession.nextUpdate()` are convenience helpers. The relay should not need them.
- Other entry points exist (`/unstable`, `/experimental/v2`). Use the stable one.

## Initialize and capabilities

- Send `{ protocolVersion: 1, clientCapabilities: {}, clientInfo }`. An empty `clientCapabilities` means no `fs` and no
  `terminal`. Both adapters then use their own file and shell tools (confirmed for Claude: it wrote files itself).
- Both adapters return `agentCapabilities.loadSession: true`. Both also advertise `sessionCapabilities`: `list`, `resume`,
  `close`, `delete`, `fork`, `title`, `additionalDirectories`, `systemPrompt`. Claude also advertises `status` and `options`.
- Prompt capabilities, both: `image`, `embeddedContext`. MCP capabilities: `http`, `acp`. Claude also `sse`.
- Auth: `authMethods` is empty for Claude (we do not advertise terminal auth). Codex lists `api-key` and `chat-gpt`.
  Both send `auth/status_update` notifications (`state: "authenticated"`).
- Capability checks: read `init.agentCapabilities` before calling `session/load`, `list`, `resume` and so on.

## Update kinds in this SDK (`SessionUpdate.sessionUpdate`)

`user_message_chunk`, `agent_message_chunk`, `agent_thought_chunk`, `tool_call`, `tool_call_update`, `plan`, `plan_update`,
`plan_removed`, `available_commands_update`, `current_mode_update`, `config_option_update`, `session_info_update`,
`usage_update`, `notice`, `compaction_update`, `compaction_summary_chunk`, `subagent_update`, `session_message`,
`session_message_chunk`.

Stop reasons: `end_turn`, `max_tokens`, `max_turn_requests`, `refusal`, `cancelled`. Permission option kinds:
`allow_once`, `allow_always`, `reject_once`, `reject_always`. A permission response is
`{ outcome: { outcome: "selected", optionId } }` or `{ outcome: { outcome: "cancelled" } }`.

## Confirmed behaviour (Claude, real turns)

- Streaming: `agent_message_chunk` arrives in small pieces (a few words) with a shared `messageId`. Tool input first arrives as a
  `tool_call` with `status: "pending"`, title "Preparing file..." and empty content, then `tool_call_update` fills in title,
  `rawInput`, then `status: "completed"` with `rawOutput`.
- Diffs: the `session/request_permission` request carries `toolCall.content: [{ type: "diff", path, oldText, newText }]`
  (`oldText: null` for a new file). This is the usable diff for approval screens.
- Permissions: only asked in mode `default` (Manual). Modes seen: `default`, `acceptEdits`, `plan`, `auto`
  (default here), `bypassPermissions` (not always offered). Options were `allow-once` / `allow-with-updates`
  (kind `allow_always`) / `reject`. Option ids are adapter specific; match on `kind`, not on id.
- `session/load` replays history as updates before the response: a `user_message_chunk` with the whole prompt, one whole
  `agent_message_chunk` (not the original small chunks), `tool_call` and `tool_call_update` in merged form. So a replay is
  coalesced; the relay should keep its own log of live messages (as planned) and use `load` only to resume the agent.
- Config options on `session/new`: `model` (category `model`) and `effort` (category `thought_level`), plus `modes`.
- Thinking: no `agent_thought_chunk` appeared in two small prompts, even with `effort=high`. Not yet confirmed.
- Usage: `usage_update` (tokens used, window size, `cost` in USD) and the prompt result `usage` carry token counts.
- Extension noise to expect: `_auth/status_update`, `auth/status_update`, many `usage_update` with `_meta["_claude/..."]`
  (model, rate limit windows), `available_commands_update` twice. The adapter prints diagnostics to stderr.

## Confirmed behaviour (Codex, up to the network)

- Without credentials, `session/new` fails at once with JSON-RPC error `-32000 "Authentication required"`.
- After `authenticate { methodId: "api-key" }` with `OPENAI_API_KEY` (or `CODEX_API_KEY`) set, `session/new` works (about
  13 s the first time). The response has `modes` (`read-only`, `workspace-write`, `agent`, `agent-full-access`), config options
  `model` and `reasoning_effort`, and the older `models` block (`availableModels`, ids like `gpt-6.2-sol[low]`).
  So Codex has both `set_config_option` and the legacy model list; build the picker from config options.
- Codex reports transport problems as `session_info_update` with `_meta.codex.error` ("Reconnecting... 2/5") and one
  `agent_message_chunk` with a warning. The prompt does not fail quickly; it retries. The relay needs its own turn timeout.
- Codex streaming granularity, thinking, diffs and permission requests are NOT confirmed (no real turn possible here).

## Install, launch, auth

- Claude: `@agentclientprotocol/claude-agent-acp`, bin `claude-agent-acp`, Node >= 22. It depends on
  `@anthropic-ai/claude-agent-sdk`, which brings the Claude Code binary as an optional dependency
  (`claude-agent-sdk-linux-x64` etc.), so no separate `claude` install is needed. `CLAUDE_CODE_EXECUTABLE` overrides it.
  Do not install with `--omit=optional`. Standalone binaries are attached to GitHub releases too. Install is about 430 MB.
- Codex: `@agentclientprotocol/codex-acp`, bin `codex-acp`. It depends on `@openai/codex`, which includes the Codex binary
  (`codex-linux-x64`), so no separate `codex` install is needed. `CODEX_PATH` overrides it.
- Launch: `bunx --bun <pkg>@<exact version>` works for both (first start downloads, 3 to 10 s). The spike spawns
  that; set `ACP_CLAUDE_CMD` or `ACP_CODEX_CMD` to use a different command. The relay no longer uses `bun x`: it
  installs the package once into its own folder and starts the entry file through a launcher
  (`docs/decisions/2026-11-23-adapter-launch.md`). `codex-acp` starts its `codex.js` with `process.execPath`, so
  it needs a JavaScript runtime there; the launcher points `process.execPath` at a script that provides one.
- Claude auth: the adapter and the bundled Claude Code read `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`, or an
  existing subscription login in `~/.claude` (`CLAUDE_CODE_OAUTH_TOKEN` also). `ANTHROPIC_BASE_URL` points at a gateway.
  `CLAUDE_CONFIG_DIR` moves the config folder. No `authenticate` call was needed.
- Codex auth: `authenticate` with `api-key` (reads `CODEX_API_KEY`, then `OPENAI_API_KEY`) or `chat-gpt` (browser login; set
  `NO_BROWSER=1` to hide it). Codex stores the login in `~/.codex`, so a key used once keeps working. Other settings:
  `INITIAL_AGENT_MODE`, `CODEX_CONFIG` (JSON), `MODEL_PROVIDER`.

## Differences from the plan's ACP message catalog

- Plan lists `session/set_model`; the SDK has no such method. Use config options (category `model`, `thought_level`).
- Update kinds: the plan lists 10 of 19. Missing: `plan_update`, `plan_removed`, `usage_update` (carries cost, useful for
  analytics), `notice`, `compaction_update`, `compaction_summary_chunk`, `subagent_update`, `session_message`,
  `session_message_chunk`. The relay must store unknown kinds untouched (it already stores raw messages).
- Plan lists `authenticate` as client-to-agent only. Agents also push `auth/status_update` notifications.
- Extra client-to-agent methods exist: `session/list`, `resume`, `close`, `delete`, `fork` (adapters), `logout`.
  `session/resume` continues a session without replay and may be better than `load` for the relay.
- `session/load` replays coalesced messages, so replayed events must not be appended to the relay log as new events.
- Claude's diff for approval is in the permission request's `content`, not only in `tool_call_update`.
- Permission option ids differ per adapter; choose by `kind`. Elicitation (`elicitation/create`) is also a possible
  agent-to-client request in this SDK; with empty capabilities we did not see one.

## Real Claude Code through the relay (23 Nov 2026, `bun run smoke:real`)

Seen with claude-agent-acp 0.109.1 driven by the relay, app and SDK (model Haiku 5.5, about $0.01 for a full run).
Recordings of these runs are in `e2e/fixtures/recordings/claude-code/` (relay event logs, scrubbed).

- **Mode.** The adapter starts in the mode the user's own settings pick (`auto` on this machine), where it never asks.
  The relay now sends `session/set_mode` `default` ("Manual") after `session/new`; only then do permission requests come.
- **What asks.** In Manual, `Edit`/`Write` and non-read-only `Bash` ask. Read-only commands (`ls`, `sleep`) and `Read`,
  `Glob`, `Grep` do not. The first `tool_call` is `pending` with a generic title ("Terminal", "Edit"); the next update
  carries the real title, `rawInput` and `locations`. Paths are absolute.
- **Model.** `ANTHROPIC_MODEL=haiku` in the agent's environment works; `session/new` then reports `currentValue: "haiku"`
  and updates name `claude-haiku-5-5`.
- **Cancel.** `session/cancel` ends the open prompt with `cancelled` within a second. Its `usage` is all zeros; the real
  tokens are only in `_meta.quota.model_usage` (the relay reads them from there).
- **Ordering.** `usage_update` (with cumulative `cost`) comes before the prompt result; the prompt result has `usage` and
  `_meta.quota`. A turn can produce 20+ `agent_message_chunk`s with one `messageId`.
- **Left as `other` on purpose:** `_auth/status_update`, `auth/status_update` (sign-in state), `available_commands_update`
  (slash commands; 40 to 60 entries), `config_option_update` (after `set_mode`), `session_info_update` (the title the
  agent invented). Nothing else arrived as `other`.
- **Relay restart.** Agents die with the daemon; the session reads as `idle`, and a new prompt fails with "This session's
  agent is not running." A new adapter process can `session/load` the old agent session id (cwd = the worktree): it
  replays about a dozen messages and the next turn remembers the earlier work. Resume is therefore possible; not built.
- **Modify fence launch settings.** `_meta.claudeCode.options` (`tools`, `disallowedTools`, `allowDangerouslySkipPermissions`,
  `settingSources: []`) is accepted. The agent never had a Bash tool (asked to "run ls first" it used Glob), and 14 of 62
  slash commands (the user's own) were gone. Plugin and managed skills are still listed; they cannot run without the
  `Skill` tool, which `tools` leaves out.
