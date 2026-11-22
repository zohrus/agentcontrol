# Abstractions review: where change will come, and whether the seams are there

Written 22 Nov 2026 against `main` at `ad1d552`. Research only, no code changed. Judged by AGENTS.md: a seam is worth having when the plan commits to a second implementation, when knowledge already leaks across a package boundary, or when it makes the code testable. Otherwise the answer is "do not abstract yet".

## Summary

| # | Axis | Seam today | Verdict | Action | Size | When |
|---|---|---|---|---|---|---|
| 1 | Where the relay runs, how we reach it | `RelayClient` + `SyncOptions.connect` (app) | Good enough until SSH | Add a `WorkspaceTarget` (bridge argv, install, forward port), check `hello` versions | M | Start of phase 5 |
| 2 | Agent and protocol | `AgentProcess` (relay); raw ACP everywhere else | **Missing, needed now** | Normalised `AgentUpdate` attached to each `acp` event by the relay; UI, usage, e2e read only that | M–L | Now |
| 3 | Where trajectories come from | `EventLog` (relay), `Store` (app) | Good enough until import | Read-only sources become "workspaces" in the app registry (axis 12); status fold shared | M | When import is decided |
| 4 | Storage | `EventLog`, `RepoStore`, `Store`; Drizzle contained | Good as is | Add a format version to events; fix the migrations path for the compiled binary | S | Before MVP release |
| 5 | Working copy of a session | None: git worktree assumed in sessions, files, archive, protocol | **Missing, needed now** (Modify agent) | `Workdir` in the relay with two kinds: `worktree`, `directory` | M | Now (phase 4) |
| 6 | Commit, push, PR | Nothing built | Do not abstract | One relay feature `publish/` using git and `gh`; no host interface | M | When built |
| 7 | Model routing and cost | `StartAgentOptions.env`; one usage source | Good enough until phase 7 | Pass `model` (accepted, then dropped); usage sources as a list of functions later | S | Phase 5–7 |
| 8 | Harness config | Nothing built | Plan is right | `Record<AgentKind, HarnessTranslator>` next to one agent registry | M | Phase 6 |
| 9 | App ↔ UI | SDK over Hono `hc`; UI not wired to SDK yet | Good, one gap | `ClientOptions.fetch`; UI reads data only through one injected `Client` | S | Now (before wiring) |
| 10 | Clock, ids, spawn, env | Clock injected in event log and UI versions; ids, env, spawn direct | Good enough | Only fix the daemon's inherited environment (explicit agent env) | S | Phase 5 |
| 11 | Waiting on you | Relay `summarize`; app re-polls; UI re-derives | Partly missing | Relay keeps live summaries, pushes changes, summary carries pending requests | M | Now |
| 12 | Multi-workspace | Store has workspaces; API, sync, SSE assume one relay | Needed by phase 5, cheap now | `links(workspaceId)`, routes resolve session → workspace, SSE carries `workspaceId` | S–M | Now (SSE), phase 5 (rest) |
| 13 | Modify agent | `UiVersions`, `UiWorkspace` built, not wired, not tested | Blocked on 2 and 5 | Run it as a relay session with a `directory` workdir; drop the unused `RunCommand` hook or use it | S | Phase 4 |

## 1. Where an agent runs and how we reach it

**(a)** App side: `RelayClient` (`packages/app/src/relays/connect.ts:15`: `call`, `onNotification`, `closed`, `close`), one implementation `connectRelay`, which spawns `<command> --stdio --data-dir <dir>` (`connect.ts:26`). `startSync` takes `connect: () => RelayClient` (`sync/index.ts:18-21`) and reconnects with backoff (`sync/reconnect.ts:42`). Relay side: `--stdio` is a bridge that starts a detached daemon and pipes to its Unix socket (`relay/src/daemon/bridge.ts:43`). The framing is newline JSON-RPC, typed by `RelayMethods` (`protocol/src/relay/map.ts:10`). Gaps: `hello` is called but its result is never checked (`sync/session.ts:83`); versions are the literal `"0.0.0"` in three places (`relay/src/daemon/handlers-workspace.ts:6`, `app/src/sync/session.ts:16`, `app/src/api/workspace.ts:30`). There is no notion of installing the relay or forwarding a port.

**(b)** Good enough until phase 5. Because the bridge is plain stdio, SSH is the same `connectRelay` with argv `["ssh", host, "agentcontrol-relay"]`; framing and reconnect carry over. What a second target must add is not transport: install/upgrade of the relay binary, a version check, and port forwarding (code-server, dev server preview), which cannot go over the stdio channel. A container (`docker exec -i … --stdio`) fits the same shape. Rivet's sandbox-agent does not: it speaks HTTP + SSE with its own event model, so it would need an adapter for every relay method. Do not build that.

**(c)** At the start of phase 5, owned by `app/src/relays/`:

```ts
/** One machine the app can run a relay on. "local" and "ssh" first; a container later if asked for. */
export interface WorkspaceTarget {
  readonly kind: "local" | "ssh";
  /** argv that runs the relay bridge on the target, without --stdio and --data-dir. */
  bridgeCommand(): string[];
  /** Copies the relay binary of this app version and starts it as a user service. */
  install(binary: string): Promise<void>;
  /** Forwards a port on the target to 127.0.0.1 on the Mac (ssh -L); local returns the same port. */
  forwardPort(remotePort: number): Promise<{ localPort: number; close(): Promise<void> }>;
}
```

`connectRelay` then takes `target.bridgeCommand()`; `startSyncSession` refuses a relay whose version differs and triggers `install`. Cost of waiting: low; `connectRelay` and `startSync` are already parameterised.

**(d)** Run the existing app suite with the relay reached through `ssh localhost` against a local sshd in CI (the plan already says so); the `sync/app-restart.e2e.ts` style tests then prove reconnect over SSH.

## 2. Which agent and which protocol

**(a)** `AgentProcess` (`relay/src/agents/types.ts:11`) is a fair seam: `prompt(text) → {stopReason}`, `cancel`, `stop`, `exited`, plus `onMessage(direction, raw)` and `onPermissionRequest`. Its only implementation, `startAgent`, is ACP (`agents/start-agent.ts:79`). Past that point ACP is not hidden at all:
- the relay stores raw messages as `kind: "acp"` and silently drops anything that is not JSON-RPC
  (`sessions/start.ts:44-50`);
- `protocol/src/events/payloads.ts:5,50,43,64`: raw message, `toolCall: unknown`, ACP option kinds, ACP stop reasons;
- `relay/src/usage/acp.ts:7-49` parses `usage_update` and the Claude-only `_meta["_claude/model"]` (line 18);
- the UI parses raw ACP: `ui-template/src/session-view/acp-updates.ts:21-61`, `reduce-acp.ts`,
  `diff-stats.ts:4-9` (ACP diff content), `reduce-permission.ts:8` (`toolCall.title`), and the fixtures build raw
  ACP (`dev-fixtures/event-helpers.ts:8`);
- e2e expectations parse ACP (`e2e/support/expect/turn-expectations.ts:7`, `agent-expectations.ts:6`,
  `app-expectations.ts:61`);
- the SDK hands `SessionEvent` with raw ACP to the UI (`sdk/src/sessions.ts:38`, `subscribe.ts:8`), and the Modify
  panel takes raw events (`ui-template/src/modify/types.ts:25`).

**(b)** Missing and needed now. This is the one leak that multiplies: the UI is user code that the Modify agent rewrites and that default-UI updates merge into. Every ACP detail the default UI parses becomes something each user's fork parses, and the SDK promises backward compatibility (plan, "Keeping conflicts rare"). An ACP or adapter change (Codex errors in `_meta.codex.error`, the 9 update kinds the plan did not list) then breaks user code we cannot fix. Gemini and OpenCode speak ACP natively, so they alone would not justify this; the user-owned UI and the external-trajectory goal (axis 3, which cannot produce raw ACP) do. Keep raw ACP stored; it is the source of truth and the analytics input.

**(c)** Protocol owns the type, the relay owns the translation (the only package that knows ACP):

```ts
// packages/protocol/src/events/agent-update.ts
export const AgentUpdate = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), role: z.enum(["user", "agent", "thought"]), text: z.string(), messageId: z.string().optional() }),
  z.object({ type: z.literal("tool"), toolCallId: z.string(), title: z.string().optional(), kind: z.string().optional(),
             status: z.enum(["pending", "running", "completed", "failed"]).optional(), paths: z.array(z.string()).optional(),
             diffs: z.array(z.object({ path: z.string(), before: z.string().nullable(), after: z.string() })).optional() }),
  z.object({ type: z.literal("plan"), entries: z.array(z.object({ content: z.string(), status: z.string() })) }),
  z.object({ type: z.literal("mode"), modeId: z.string() }),
  z.object({ type: z.literal("notice"), text: z.string(), severity: z.string().optional() }),
  z.object({ type: z.literal("usage"), model: z.string().optional(), costUsd: z.number().optional(), tokens: z.object({ input: z.number(), output: z.number(), cacheRead: z.number(), cacheWrite: z.number() }).optional() }),
]);
// AcpPayload gains: updates: z.array(AgentUpdate).default([])
// PermissionRequestedPayload gains: tool: { title, kind, paths, command? } next to the raw toolCall
```

The relay fills `updates` with `agents/acp/normalize.ts` when it emits an event (`sessions/subscribe.ts` `deliver`, and `Sessions.events`), not when it writes, so the JSONL stays raw and better translation applies to old logs too. Then `usage/acp.ts` reads `updates`, the UI's `acp-updates.ts`/`diff-stats.ts` go away (its reducers switch on `update.type`), and e2e expectations read `updates`. Size M–L (relay normaliser and UI reducers are about 300 lines each way). Cost of waiting: the UI is still on fixtures (`ui-template/src/App.tsx:5-13`); once it is wired to the SDK and users start forking it, the raw shape is frozen into their code.

**(d)** API tests assert on `updates` (agent text, tool status, diff stat) using the existing mock agent; one test where the mock sends an unknown update kind and the session still renders, with the raw message kept; one where the mock sends Claude-style `_meta` and usage shows the model.

## 3. Where session history comes from

**(a)** Relay: `EventLog` (`relay/src/event-log/index.ts:8`) fuses append with seq/ts assignment, read, listing and live subscribe; one JSONL implementation. Session facts live only in events: `sessionInfo` re-reads the whole log on every `fs.read`, `fs.tree`, `diff` and permission answer (`sessions/context.ts:32-40`), and `list()` re-reads every log (`sessions/index.ts:73-81`). App: `Store` (`app/src/store/types.ts:15`) is the read side; all history routes read the store only (`api/sessions-read.ts:22-41`). Status is derived only in the relay (`relay/src/sessions/summarize.ts:147`).

**(b)** Good enough until the owner decides what import means. Fusing write and seq in `EventLog` is right for the relay. The real seam for external trajectories is in the app: a source that fills `Store` under its own workspace id, with app-assigned seq, and refuses commands. That is the same registry as axis 12, so build one thing. Missing pieces when it comes: the status fold runs only in the relay, so an app-side source has no status; `sessions.id` is the only primary key (`store/schema.ts:12`) and `eventsAfter` ignores the workspace (`store/events.ts:32`), so foreign ids could collide. Agent logs (`~/.claude/projects`, `~/.codex/sessions`) live on the workspace, so that importer belongs in the relay, writing a read-only log. The full-log re-reads are a performance bug for long sessions whatever we decide; axis 11 fixes them.

**(c)** When import is scheduled: move `summarize` to `protocol/src/sessions/` (pure fold over protocol types, as `parseMessageLine` already is); make the store key `(workspace_id, id)`; add a read-only workspace kind. M.

**(d)** An importer fed from a JSONL recorded from a mock-agent run: the imported session lists with its status, its events read back through the SDK, and `sendPrompt` answers 409 "read-only".

## 4. Storage

**(a)** Relay: `EventLog` and `RepoStore` (`repos/store.ts:8`) interfaces, JSONL and `repos.json`. App: `Store` interface; Drizzle, schema, row mapping and migrations stay inside `app/src/store/`.

**(b)** Good as is. Nothing in the plan asks for SQLite or object storage on the relay, and cross-device sync contradicts "local-first". Two small defects: events carry no format version (`protocol/src/events/event.ts:5`), and migrations are found through `import.meta.dir` (`store/db.ts:8`), which breaks under `bun build --compile` (the relay already special-cases `/$bunfs/`, `daemon/bridge.ts:12`).

**(c)** Add `v: 1` to the event base; embed migrations for the compiled build. S each.

**(d)** An app test that opens a `state.db` fixture created by the previous migration set and reads its sessions.

## 5. The working copy of a session

**(a)** No seam. Git worktree is assumed in `relay/src/sessions/index.ts:54` (`createWorktree`), `sessions/archive.ts:22-33` (`uncommittedFiles`, `removeWorktree`), `daemon/handlers-files.ts:17-37` (passes `worktreePath`/`baseBranch` to `diffWorktree`, `fileTree`, `readFileAt`), `files/read.ts:37` and `files/tree.ts:19` (git commands), and in protocol field names: `repoPath`, `baseBranch`, `branch`, `worktreePath` (`events/payloads.ts:15-22`, `sessions/summary.ts:12-13`, `sessions/methods.ts:13-20`), `gitStatus` (`files/methods.ts:13`), `ref: base|head|working` (`files/methods.ts:19`), `baseCommit` (`worktrees/diff.ts:17`); also the app's columns (`store/schema.ts:18-20`) and the SDK's `StartSession` (`sdk/src/sessions.ts:11-21`).

**(b)** Missing and needed now: the Modify agent must run in `ui-staging/`, a plain folder, and today `relay/sessions.create` can only make a worktree. Running it from the app instead would duplicate agent spawning, logging and permissions there. That is two real uses, so the seam is justified. jj, containers and remote checkouts: do not design for them.

**(c)** Owned by a new relay feature `workdirs/` (the current `worktrees/` becomes one implementation):

```ts
export type WorkdirSpec =
  | { kind: "worktree"; repoPath: string; baseBranch: string }
  | { kind: "directory"; path: string };

export interface Workdir {
  readonly path: string;
  readonly env: Record<string, string>;            // ports
  tree(): Promise<FsEntry[]>;                      // directory: readdir, no gitStatus
  read(path: string, ref: FileRef): Promise<string>; // directory: "working" only
  diff(): Promise<DiffResult | undefined>;         // directory: undefined (Modify uses UiWorkspace.pendingChanges)
  uncommitted(): Promise<string[]>;                // directory: []
  remove(): Promise<void>;                         // directory: no-op
}
```

`SessionsCreateParams` takes `workdir: WorkdirSpec`; `session-created` records it; summaries keep `branch` optional. M. Cost of waiting: phase 4 stalls, or the Modify agent gets its own spawning path in the app.

**(d)** A relay test that starts a mock-agent session in a non-git temp folder: the agent's edit shows in `fs.tree`/`fs.read`, `diff` answers "not available", archive leaves the folder in place.

## 6. Commit, push, PR

**(a)** Nothing yet (TASKS.md "How work leaves a worktree"). **(b)** Do not abstract: one host (GitHub), and `gh` exists. Commit and push are git operations on the workspace, so they belong in the relay, as a `worktree`-only capability of axis 5. **(c)** A relay feature `publish/` with `relay/git.commit`, `relay/git.push`, `relay/pr.create` (shelling out to `gh` like `git/index.ts` does); M when built. **(d)** Push to a local bare repo used as `origin` and check the branch arrives; PR creation only in the nightly smoke run.

## 7. Model routing and cost

**(a)** `StartAgentOptions.env` (`agents/types.ts:27`) is where gateway variables would go; it carries only ports today. `SessionsCreateParams.model` is accepted (`protocol/src/sessions/methods.ts:19`) and dropped (`sessions/start.ts:68` passes no model). One usage source, `usageFromEvents`; `UsageRow.source` is `z.literal("acp")` (`protocol/src/usage/methods.ts:16`). No price data. **(b)** Good enough until phase 7; the dropped `model` is a bug to fix when the picker is wired. **(c)** Phase 7: `UsageRow.source` becomes an enum and the relay merges a list of readers (`acp`, agent log files, gateway log); prices in one app module. S–M.

**(d)** The mock agent reports usage already (`e2e/usage/usage.e2e.ts`); add a mock step that echoes an env var to prove gateway injection.

## 8. Harness configuration

**(a)** Nothing built; protocol has no config items yet. Agent identity is spread over `protocol/src/ids/enums.ts:4`, `relay/src/agents/commands.ts:3-15` and `ui-template/src/session-list/labels.ts:70-74`.

**(b)** The planned "one translator per harness" is the right seam and must not get its own agent list.

**(c)** Phase 6: one registry in `relay/src/agents/registry.ts`, `Record<AgentKind, AgentDefinition>` holding `label`, `command`, `instructionsFile` and `translator: { inspect(): Promise<ConfigItem[]>; plan(items): FileChange[] }`. The `Record` makes a new `AgentKind` a compile error until every field is filled. `hello` returns `{kind, label}` so the UI stops hard-coding names. M. **(d)** Plan/apply against a temp `$HOME` per test, read back the files.

## 9. App ↔ UI boundary

**(a)** `createClient({ baseUrl })` over `hc<AppType>` (`sdk/src/index.ts:22-35`); SSE via global `fetch` (`sdk/src/subscribe.ts:32`). The UI imports only `protocol` today and runs on fixtures; components take data as props (good). **(b)** Good, with one gap: nothing lets the SDK talk to anything but HTTP at a URL (a recorded session for demos, an auth header later). **(c)** `ClientOptions.fetch?: typeof fetch` passed to `hc` and to `subscribeTo`; the UI's data hooks take the `Client` from one React context. S, before the UI is wired.

**(d)** Playwright tests use the real client; the dev preview uses a fixture `fetch`, which also replaces `dev-fixtures/` building raw ACP.

## 10. Time, ids, randomness, spawning, env

**(a)** Injected: event-log clock (`relay/src/daemon/server.ts:53`), UI-versions clock (`app/src/ui-versions/index.ts:72`), config args/env (`app/src/config.ts:17`), the relay connection (`SyncOptions.connect`). Direct: `crypto.randomUUID` (`relay/src/sessions/index.ts:53`, `agents/start-agent.ts:20`, `repos/store.ts:33`), `new Date()` (`app/src/sync/session.ts:84`), `process.env` read deep inside `agents/commands.ts:32`, and every child inherits the daemon's environment (`agents/spawn.ts:35`, `git/index.ts:16`, `worktrees/setup-script.ts:24`). **(b)** Good enough: e2e tests never assert ids or times, and an id/clock DI would add parameters with no test that uses them. One real problem: the detached daemon inherits the environment of whichever app first started it (`daemon/bridge.ts:16`), so agent env (keys, gateway URL, the mock command) is frozen until the daemon restarts. **(c)** Phase 5 (with the gateway): build the agent environment in one function from an allowlist plus per-session values. S. **(d)** A test that restarts the app with a different agent env and sees the new value in a new session.

## 11. Waiting on you

**(a)** Rules live once, in `relay/src/sessions/summarize.ts:101`. But the app hard-codes which event kinds may change status (`app/src/sync/session.ts:19-29`) and then refetches the whole list, which re-reads every log; the UI re-derives "turn running" (`ui-template/src/session-view/reduce-events.ts:59`); and no API returns the pending request a row needs for Approve/Deny (`ui-template/src/session-list/types.ts:39-57`), so the list would need every session's events. **(b)** Partly missing, needed before the inbox view. **(c)** The relay keeps one summary per session in memory, folded on append (it already folds), and pushes a `relay/session.changed` notification; `SessionSummary` gains `pending: { requestId, title, options }[]` and `turnOpen`. The app forwards summaries and drops `STATUS_CHANGING`; menu bar, browser notifications or a phone read `sessions` from the SDK without deriving anything. M. **(d)** The existing waiting-on-you tests, plus: the list row of a waiting session carries the request title and its options.

## 12. Multi-workspace

**(a)** Single relay hard-coded: `app/src/main.ts:18` (workspace `"local"`), `ApiDeps.relay: Link` (`api/deps.ts:8`); every command route calls that one link (`api/sessions-commands.ts`, `api/files.ts`, `api/workspace.ts:12-31`, which also runs `relay/hello` per request to list agents). SSE `sessions` messages are `SessionSummary` without `workspaceId` (`sync/session.ts:52`, `sdk/src/subscribe.ts:10`) while `list()` returns rows with it (`sdk/src/types.ts:4`). **(b)** Needed by phase 5. The SSE shape is public SDK surface, so fix it now.

**(c)** Now: publish `StoredSession` (with `workspaceId`) on SSE. Phase 5: `ApiDeps.links: (id: WorkspaceId) => Link`, session routes look up the session's workspace in the store, repo/agent/check routes take `?workspace=` (optional, so the SDK stays compatible), `startSync` runs once per workspace. S now, M later.

**(d)** Start the app with two local relays (two data folders) as two workspaces: a session started on each lists under its own workspace and archive reaches the right relay. This proves routing without SSH.

## 13. The Modify agent's dependencies

**(a)** `UiVersions` (isomorphic-git, clock injected) and `UiWorkspace` (staging, promote, checks, keep/undo) exist with clean interfaces, but nothing calls them: they are exported from `app/src/index.ts:3-7` (which keeps knip quiet) and no e2e test runs them. The agent session needs axis 5 (directory workdir) and an app-side auto-answer of permission requests, which needs axis 2 (`tool.kind`, `tool.paths`) to decide "edit inside ui-staging". `RunCommand` (`ui-workspace/checks.ts:13`) is injected "so tests can skip the slow real tools", but the rules allow no such test: one implementation, no caller. **(b)** Template source (`templateDir`, `templateVersion`) and history are fine. **(c)** Wire through the relay with `workdir: { kind: "directory" }`; remove `RunCommand` or use it from e2e. S once 2 and 5 land. **(d)** The scripted Modify agent from TASKS.md (the mock agent editing `ui-staging/`): Keep then Undo restores the file; an edit outside staging is refused.

## Leaks, ranked by future cost

1. Raw ACP parsed by the user-editable UI and exposed by the SDK: `ui-template/src/session-view/acp-updates.ts:21-61`, `reduce-acp.ts:56-71`, `diff-stats.ts:4-9`, `reduce-permission.ts:8-16`, `modify/types.ts:25`, `dev-fixtures/event-helpers.ts:8`; `sdk/src/sessions.ts:38`, `sdk/src/subscribe.ts:8`.
2. Git vocabulary in the shared contract: `protocol/src/events/payloads.ts:15-22`, `sessions/summary.ts:12-13`, `sessions/methods.ts:13-20`, `files/methods.ts:13,19`, `worktrees/diff.ts:17`; `app/src/store/schema.ts:18-20`.
3. One relay assumed by the app: `app/src/main.ts:18`, `api/deps.ts:8`, `api/workspace.ts:12-31`, `api/files.ts:14-29`, `api/sessions-commands.ts:20-59`, `store/events.ts:32`, `store/schema.ts:12`.
4. ACP shapes in protocol payloads: `protocol/src/events/payloads.ts:5,43,50,64`.
5. App knows the relay's status rules: `app/src/sync/session.ts:19-29`; UI re-derives: `reduce-events.ts:59-64`.
6. Vendor `_meta` in a generic module: `relay/src/usage/acp.ts:18,26`; `UsageRow.source` literal `protocol/src/usage/methods.ts:16`.
7. e2e helpers parse ACP: `e2e/support/expect/turn-expectations.ts:7-12`, `agent-expectations.ts:6,42`, `app-expectations.ts:61`.
8. SSE `sessions` payload without `workspaceId`: `app/src/sync/session.ts:52`, `api/stream.ts:13`.
9. Agent identity in three packages, test agent in the product enum: `protocol/src/ids/enums.ts:4`, `relay/src/agents/commands.ts:3-15`, `ui-template/src/session-list/labels.ts:70-74`.
10. Daemon environment frozen at first start: `relay/src/daemon/bridge.ts:16`, `agents/spawn.ts:35`, `agents/commands.ts:32`.
11. Accepted then dropped: `model` in `protocol/src/sessions/methods.ts:19` vs `relay/src/sessions/start.ts:68`; `mcpServers: []` fixed in `agents/start-agent.ts:46`.
12. Version strings and an unchecked handshake: `relay/src/daemon/handlers-workspace.ts:6`, `app/src/sync/session.ts:16,83`, `app/src/api/workspace.ts:30`.
13. Non-JSON-RPC agent output dropped without a trace: `relay/src/sessions/start.ts:46-49`.
14. Migrations path breaks in the compiled app: `app/src/store/db.ts:8`.
15. Runtime code exported as the app's package API only to satisfy knip: `app/src/index.ts:2-7`.

## Proposed order

**Now, before more code sits on top (max 5):**
1. Normalised `AgentUpdate` (axis 2), before the UI is wired to the SDK. M–L.
2. `Workdir` with `worktree` and `directory` kinds (axis 5), unblocking the Modify agent. M.
3. Live summaries in the relay with pending requests, pushed to the app (axis 11); also ends the full-log re-reads in `sessionInfo` and `list`. M.
4. `workspaceId` on every SSE message, store key `(workspace_id, id)` (axis 12, public part). S.
5. `ClientOptions.fetch` and one injected `Client` for the UI's data layer (axis 9). S.

**Start of phase 5:** `WorkspaceTarget` (bridge argv, install, port forward); version check on `hello`; event format version; explicit agent environment; `links(workspaceId)` routing and one `startSync` per workspace; the suite over SSH to a local sshd; a two-local-relays test.

**Phase 6:** agent registry with `label`, `command`, `instructionsFile`, `translator`; `hello` returns labels; config item schemas in protocol; MCP servers passed in `session/new`.

**Phase 7:** usage readers as a list (`acp`, agent logs, gateway), prices in the app; analytics read `updates`, never raw ACP. Shared `summarize` in protocol if imports or analytics need status app-side.

**Never:** a transport or plugin framework; a DI container or injected id/clock generators nobody asserts on; alternative `EventLog`/`Store` backends without a requirement; a VCS-host interface before a second host; an adapter that makes sandbox-agent look like our relay; dropping raw ACP from the log; a git abstraction for jj.

## To discuss with the owner

1. Are non-ACP agents in scope? If not, `AgentProcess` stays ACP-shaped and only the output is normalised.
2. The plan says "events carry the raw ACP message unchanged, so the UI sees exactly what the agent sent". Axis 2 proposes the UI sees normalised updates and raw stays stored. This changes a plan decision.
3. External trajectories: read-only viewing, or sessions that can be resumed? Imported in the app (cloud trace systems) or in the relay (agent logs on the workspace)? And sessions started outside the app (TASKS.md)?
4. Should the Modify agent run as a relay session in a plain folder (proposed) or be spawned by the app?
5. Containers or cloud sandboxes as workspaces: in scope after SSH, or never? It decides whether `WorkspaceTarget` stays two kinds.
6. PRs: `gh` on the workspace with its login, or the GitHub API from the app with a keychain token?
7. Relay version skew: the plan says running sessions keep the old relay; does the app then talk to two relay versions at once on one workspace?

