# The relay is compared by the code it runs, not only by its version

Date: 24 Nov 2026. Status: decided.

## What went wrong

The relay is a daemon that keeps running when the app closes. After a `git pull` and a restart of
`bun dev`, the new app talked to the relay that was started before the pull, still running the old
code. Both said they were version 0.1.0, so the version check on `relay/hello` (which already stops an
idle relay of another version, locally and over ssh) saw nothing, and the first request the old code
could not read, "Create session" without a prompt, came back as zod's list of issues. The same holds
for a relay binary left on an ssh host: its folder is named after the version, and the connector
treated "a file is there" as "up to date".

Reproduced with a real old relay (the code of the commit before `3a60c14`) kept running while the new
app started on the same data folder: the workspace read `connected` with `relayVersion` 0.1.0, and
`POST /api/sessions` without a prompt returned `invalid-request` with the zod dump.

## Decision

- **Build identity** (`packages/protocol/src/build-id.ts`, imported as
  `@agentcontrol/protocol/build-id`): a 12-character hash of what the relay is made of, namely every
  file under `packages/protocol/src` and `packages/relay/src` and the two `package.json` files (the
  exact pins of the relay's dependencies). It changes when any of them changes, committed or not, so
  a dirty checkout and a pulled one both differ from the relay that was started earlier. The app, the
  UI and the docs are left out on purpose: a change to them must not restart a relay that is working.
- **Three ways to run, one function.** From source (`bun dev`): hashed at start
  (about 20 ms for the roughly 170 files). The relay hashes once, when it starts, because that is the
  code it loaded; the app hashes on every connect, so an app still running after an edit compares the
  relay with the code as it is now, and a relay started after the edit is the app's own (no restart
  loop). Compiled: `scripts/build.ts` computes it once and passes
  `--define AGENTCONTROL_BUILD_ID=...` to every `bun build --compile`, so the app and every relay
  binary of one build carry the same value; nothing is read at run time. Installed on an ssh host:
  the compiled relay carries its own. If neither works (a compile that skipped the define, in a
  folder without the sources) the identity is `unknown`, which equals itself, so it can never start a
  replacement loop.
- A git commit hash was rejected: it ignores uncommitted edits (the normal state of `bun dev` while
  developing) and needs git at run time. A timestamp of the build was rejected: not deterministic, and
  two builds of the same code would differ.
- `relay/hello` reports it as `buildId`. A relay older than this field reports none, which counts as
  different, so the first update from a relay that predates it is handled too.
- **Same rule everywhere** (`app/src/sync/relay-identity.ts`): a relay whose version or build differs
  is replaced when none of its sessions is working (stopped; the sessions are then shown as
  interrupted and can be resumed, see `2026-11-23-session-resume.md`), and otherwise left running with
  the workspace in `needs-relay-update`. This Mac uses the same rule as an ssh host; it already had
  the hook (`stopLocalRelay`) but the version never differed.
- **What the user is told** when a busy relay is left: the workspace's `reason` (shown in Workspaces
  and the status bar) says "The relay runs other code than this app, although both are version X
  (relay build A, app build B). It was probably started before the app was updated. N sessions are
  still working on it, so it was left running. Restart it when they are done, or use Restart relay to
  end them now (they can be resumed)." `Restart relay` now works for This Mac too.
- **ssh install**: the connector no longer trusts that a file at the versioned path is the right one.
  It inspects the host once per connection loop and calls the install step on every connection, which
  compares checksums and uploads only on a difference (the check on the host is one `sha256sum`).
  `WorkspaceTarget.isInstalled()` is gone.
- **Stale `dist/` in a source checkout**: `bun scripts/build.ts` records the build in
  `dist/manifest.json`. An app run from source compares it with the checkout's current identity before
  installing, and refuses with "The relay in dist/ was built from build X, but this checkout's relay
  code is build Y. Build it again with: bun scripts/build.ts --only relay-linux, then retry." A release
  has no such check: its binaries are built together.
- **A schema refusal from the relay is not the user's mistake.** The relay marks an `invalidParams`
  answer about the shape of the params with `data: { schemaRefusal: true }`
  (`SCHEMA_REFUSAL`, `isSchemaRefusal` in the protocol). A relay from before the marker is recognised
  by zod's message (a JSON list of issues), which is the very case that started this. The app answers
  502 `relay-disagrees` with a plain message, "The relay and the app disagree about this request,
  which usually means the relay is still running older code than the app, so nothing was changed. Open
  Workspaces and use Restart relay, or quit AgentControl and open it again once no session is
  working.", and keeps what the relay said in `data.detail`. The UI shows that message as it is. Bad
  input that the app itself catches still reads "AgentControl could not use what was entered."

A reconnect of an ssh workspace (sleep, network) does not repeat the stale `dist/` refusal: only the
first connection of an app run insists on a current build, so a working host is not sent offline by
an edit that was never built.

## Not done

- Requests are not refused up front while a busy relay of other code is in use; the plain message above
  is what the user gets for the ones the old code cannot read.
- The Mac build was not run here (Linux only); the build change is the same `bun build --compile`
  flag on every target.
