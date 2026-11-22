# Normalised agent updates
Date: 2026-11-22   Author: Claude (agent update task), decided by the owner

## Context
The plan said events carry the raw ACP message unchanged so the UI sees what the agent sent. But the
UI is user code that the Modify agent rewrites, so every ACP detail it parses is frozen into each
user's fork (docs/abstractions-review.md, axis 2, leak 1). Adapters also differ (Claude's
`_meta["_claude/model"]`, Codex's `_meta.codex.error`).

## Decision
- The raw ACP message stays stored unchanged in the relay's JSONL log (never dropped).
- Consumers (UI, usage, analytics, tests) read `AgentUpdate` (`packages/protocol/src/events/agent-update.ts`),
  attached by the relay when it serves an event: `acp` payload gets `updates`, `permission-requested`
  payload gets `tool` (same `ToolDescription` as a `tool-started` update, so permission needs no
  update variant of its own). Computed on replay and live, never written, so old logs get new
  translation for free.
- `packages/relay/src/acp-normalise/` is the only code that knows ACP update shapes. A dispatch table has one
  small reader per `sessionUpdate` kind; unread kinds become `{ type: "other", name }`.
- `scripts/acp-leaks.ts` (`bun run acp-leaks`, part of `bun run check`) fails on raw ACP names in
  app, sdk, ui-template and e2e/support/expect, with a dated allow-list.
- Non-ACP agents are out of scope: `AgentProcess` stays ACP-shaped; only its output is normalised.

Variants: `user-text`, `agent-text`, `agent-thought`, `plan`, `tool-started`, `tool-updated`,
`mode-changed`, `notice`, `usage` (context used/size, cumulative cost, model), `turn-usage` (tokens
of one turn, model), `turn-ended`, `other`. Differences from the review's sketch: text roles are
separate variants (easier to switch on); tools are two variants (started/updated patch) with
`kind` in a small enum (ACP `delete`/`move` map to `edit`); `files` carries `{path, oldText?, newText}`
or counts; `usage` split in `usage` and `turn-usage` because ACP reports them separately.

## Rejected
Storing `updates` in the log (old logs would stay stale). A permission AgentUpdate (the event kind
already exists). Hiding raw ACP from the log (it is the source of truth and analytics input).

## Consequences
Usage reads only updates. Events already stored in the app's SQLite before this change lack
`updates` until the app resyncs. Interpreting more kinds (`plan_update`, `compaction_update`, ...)
is a change in the relay module only. The mock agent keeps speaking real ACP.

## UI migration (follow-up, mechanical)
Not done here (the UI data layer is being rewritten). Switch these `packages/ui-template/src/session-view/`
modules, then delete their entries from the allow-list in `scripts/acp-leaks.ts`:
`acp-updates.ts` (delete), `reduce-acp.ts` (switch on `update.type` over `event.payload.updates`),
`reduce-notices.ts`, `reduce-permission.ts` (use `payload.tool?.title`), `diff-stats.ts`, and
`dev-fixtures/*` (build `updates` instead of raw ACP).

| View item | AgentUpdate |
|---|---|
| `user` | `user-text` (`text`, `messageId`) |
| `message` | `agent-text` |
| `thought` | `agent-thought` |
| `plan` | `plan` (`entries`) |
| `tool` | `tool-started`, then `tool-updated` merged by `toolCallId`; path = `paths[0]`; stat from `files` (count lines of `oldText`/`newText`) or `{additions, deletions}` |
| `tool-group` | consecutive `tool-started` with kind `read` or `search` |
| `mode` | `mode-changed` (`modeId`) |
| `notice` | `notice` (`text`, `severity`); compaction has no data in `other` (name `compaction_update`): ask for a variant when the UI needs it |
| `permission` | event `permission-requested`: `payload.tool` (title, kind, files, command) |
| `turn-ended` | event kind `turn-ended` (status source); the `turn-ended` update is the same fact inside the acp stream, ignore it to avoid doubles |
| header usage chip | `usage` (`contextUsed`, `contextSize`, `costUsd`, `model`) |
| `setup`, `agent-exited` | unchanged event kinds |
