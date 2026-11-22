# AgentControl

Local-first Mac app to run coding agents (Claude Code, Codex) on the local machine, and later on
SSH workspaces. It shows which sessions are waiting on the user and lets the user review and edit
their changes. The whole web UI is user code that a built-in Modify agent rewrites on request.

`AgentControl` / `agentcontrol` is a working name. The full plan, with rationale, is
`docs/plan.html`: read the relevant section before an architectural change. Progress is tracked in
`docs/status.html`, and deferred items in `TASKS.md`.

This file holds the rules for every agent and human working here. `CLAUDE.md` only imports it.

## Decisions (do not change without asking the user)

- **Local-first.** One process on the user's Mac. No central server, no accounts. State lives in
  one SQLite file under `~/.agentcontrol/`.
- **Platform:** the app runs on macOS only (Apple Silicon and Intel). Remote workspaces are Linux.
  License: MIT.
- **MVP is local only:** phases 1–4 (local relay, local app, SDK and default UI, Modify agent), then
  the first Mac release. Remote workspaces are phase 5, harness config phase 6, analytics phase 7.
- **ACP** (Agent Client Protocol) for every agent: `@agentclientprotocol/sdk`, with the
  `claude-agent-acp` and `codex-acp` adapters. Never advertise ACP `fs` or `terminal` capabilities.
- **Relay** (also on the local machine): spawns adapters, appends every ACP message to a JSONL log
  per session with a sequence number, holds pending permissions, keeps running when the app closes.
  The app talks to it with JSON-RPC 2.0 over stdio and resumes with "events after N".
- **Browser ↔ app:** HTTP + SSE with Hono. Its typed client becomes `@agentcontrol/sdk`.
- **One git worktree per session.** Session diff is every change since the base branch,
  committed or not, untracked files included: merge-base against the working tree, using a
  throwaway `GIT_INDEX_FILE` so the real index is never touched.
- **Archive:** stops the agent, removes the worktree (warns first if there are uncommitted
  changes), keeps the branch and the event log.
- **Worktree setup per repo:** files to copy (default `.env*`), a setup script, a port block per
  session (`PORT`, `AGENTCONTROL_PORT_BASE`).
- **UI versions:** a hidden git repo via `isomorphic-git` in `~/.agentcontrol/ui.git/`, outside
  the Modify agent's folder. Branch `upstream` gets one commit per default-UI release; branch `main`
  is the user's, and each Keep is a commit whose message is the user's request. Default-UI updates
  merge `upstream` into `main` (never rebase); the Modify agent resolves conflicts.
- **Modify agent** edits only `ui-staging/`. It runs no shell commands and has no web access. This
  is enforced by its permission settings and by the app refusing every other permission request.
- **`/_safe`** is served by the app itself and always allows rollback.

## Principles

- **Single responsibility first.** One module, one reason to change. If describing a file needs
  "and", split it.
- **KISS.** Plain functions and modules. No abstraction before the second real use, no DI
  framework, no clever types, no `utils/` dumping ground.
- **Open/closed where it pays.** Agents and harness translators sit behind one small interface each.
- **Injected edges.** Logic receives its store, transport and clock as parameters. Only the edges
  (ACP, SQLite, fs, git, HTTP, SSH) touch the outside world.
- **Dispatch tables over long switches**, for example one small handler per ACP update kind.

## Structure

```
packages/
  protocol/     shared types and zod schemas: relay methods, events, config items. Imports nothing.
  relay/        workspace daemon: ACP client, event log, permissions, worktrees, fs
  app/          local server: relay connections, store, sync, status, API, Modify agent
  sdk/          @agentcontrol/sdk, the only way the UI reaches the API
  ui-template/  default UI (Vite + React + Tailwind + shadcn/ui), copied to the data folder
  mac/          menu bar shell and installer scripts
e2e/            end-to-end tests and their helpers
scripts/        build, sign, notarize, release
docs/           plan.html, status.html
```

- Feature folders inside each package (`relay/src/sessions/`, `relay/src/worktrees/`), not layers.
  Each feature exposes one `index.ts`; other features import only that.
- Dependency rules (enforced by dependency-cruiser): `ui-template → sdk → (HTTP) app → (JSON-RPC)
  relay → (ACP) agents`. Every package may import `protocol`; `protocol` imports nothing. The UI
  only talks to the SDK, the relay never imports the app, no feature imports another feature's
  internals, no cycles.

## Tests

- **End-to-end only. No unit tests.** Every test starts the real app and relay and drives them as
  a user would. The only fake is the agent: a scripted mock ACP agent (`e2e/support/mock-agent/`),
  so tests are deterministic and need no API key.
- Two levels: API tests through `@agentcontrol/sdk` with `bun test`, and browser tests of the
  default UI with Playwright.
- **GIVEN / WHEN / THEN as comments**, not wrapper functions. GIVEN, WHEN and THEN each open with
  a three-line banner; extra steps are a single `// AND ...` line. Each comment says in plain words
  what is set up, done or checked, and the code under it is one or two helper calls.

```ts
// e2e/sessions/waiting-on-you.e2e.ts
test("a session that asks to run a command is shown as waiting on you", async () => {
  // ********************************************************************
  // ** GIVEN the app is running with one local workspace
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  // AND the agent will ask permission to run `npm test` on its first turn
  app.mockAgent.willAskToRunCommand("npm test");

  // ********************************************************************
  // ** WHEN the user starts a session asking to add rate limiting
  // ********************************************************************
  const session = await app.user.startsSession({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN the session list flags the session as waiting for approval
  // ********************************************************************
  await expectSessionWaitingForApproval(app, session);
  // AND the pending request names the `npm test` command
  await expectPendingRequestToRunCommand(app, session, "npm test");
});
```

- One behaviour per test; the test name is a sentence about what the user sees.
- No logic in tests: no `if`, loops or sleeps. Helpers wait for events instead of sleeping.
- Every test gets its own data folder and workspace, so tests run in parallel.
- Helpers are named after the domain fact: `expectSessionWaitingForApproval`,
  `app.mockAgent.willEditFile("src/server.ts")`. Never `assertOutput`, `checkSession`,
  `verifyState`, `setupData`. Setup helpers live in `e2e/support/setup/`, assertions in
  `e2e/support/expect/`.
- Assertion failures read as plain language:
  `expected session "Add rate limiting" to be waiting for approval, but it is running`.

## Quality gates

`bun run check` runs every gate plus the tests, locally and in CI. All of them break the build.
When a limit is hit, split the code. **Never raise a limit and never disable a rule to pass.**
Limits only ever go down.

| Area | Setting |
|---|---|
| Cyclomatic complexity | ESLint `complexity`: max 5 per function |
| Cognitive complexity | `sonarjs/cognitive-complexity`: max 8 |
| Size and nesting | `max-depth` 2, `max-params` 3 (pass an object), `max-statements` 12, `max-lines-per-function` 30, `max-lines` 200 per file, `max-nested-callbacks` 2, `no-nested-ternary` |
| Types | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnused*`, `noFallthroughCasesInSwitch`; typescript-eslint `strict-type-checked` |
| Architecture | dependency-cruiser: layering above, no cycles, no feature internals |
| Dead code | knip: unused files, exports, dependencies |
| Duplication | jscpd: 50+ tokens, no clones allowed (threshold 0) |
| Escape hatches | `--max-warnings 0`; every `eslint-disable` needs a written reason; unused disables are errors |
| Formatting | Biome (formatter only) |
| Security | `bun audit`, gitleaks, Dependabot |
| Git hooks | lefthook: format and lint staged files before commit; typecheck before push |

## Dependencies

Bun built-ins first (SQLite, HTTP server, test runner, spawn, hashing, glob, compile). Add a
library only when it saves hundreds of lines, and only if it is owned by a known organisation or a
long-standing maintainer, released in the last 12 months, permissively licensed (copyleft only for
dev tools that never ship), with few dependencies. Pin exact versions and commit `bun.lock`.

Approved: `@agentclientprotocol/sdk`, `claude-agent-acp`, `codex-acp`, `hono`, `drizzle-orm`,
`drizzle-kit`, `zod`, `isomorphic-git`, `react`, `vite`, `@vitejs/plugin-react`, `tailwindcss`,
`monaco-editor` (used directly), shadcn/ui code copied in with individual `@radix-ui/react-*`
primitives, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`; dev:
`@playwright/test`, `typescript`, `eslint`, `typescript-eslint`, `eslint-plugin-sonarjs`,
`@eslint-community/eslint-plugin-eslint-comments`, `dependency-cruiser`, `knip`, `jscpd`,
`@biomejs/biome`, `lefthook`.

Not allowed: `json-render`, `@monaco-editor/react`, tRPC, `jsdiff`, `node-diff3`, CodeMirror,
Prettier, crossby (use its mappings as reference only), the `radix-ui` bundle.

## Commands

- `bun install`: install dependencies.
- `bun dev`: app, UI with hot reload and the local relay; opens the browser.
- `bun run test`: the end-to-end suite against the mock agent.
- `bun run check`: every quality gate plus the tests.

## Before you push or hand back work

Every agent does these, in this order, on its own changes. No exceptions.

1. **Tests.** New or changed behaviour has an end-to-end test that reads as a specification.
   Line coverage from the end-to-end suite must stay at 95% or more: at most 5% of lines may be
   uncovered. Code that no end-to-end test runs does not get pushed.
2. **Gates.** `bun run check` passes. Fix findings by changing the code.
3. **Code review.** Run the `/code-review` skill on your own diff. Fix every bug it finds, then run
   it again until it reports none. Say in your report that you ran it and what it found.
4. **Plan and status.** `docs/plan.html` is the single source of truth: every decision, task and
   change of direction is written into it (and the long tail into `TASKS.md`) in the same push
   that makes it true. `docs/status.html` shows each component's status. The orchestrator updates
   both; tell it in your report what changed.

## Working in parallel

- Each coding agent works in its own git worktree and branch, started from the latest `main`, and
  only edits the paths its brief names.
- Never `git add -A`, `git add .` or `git commit -a`: add the files you own by path.
- Never run a formatter or linter with `--write` or `--fix` on the whole repo: only on your paths.
- Never add or upgrade a dependency yourself: ask the orchestrator, who does it in one place.
- Interfaces between parallel pieces are committed as code (zod schemas and types in
  `packages/protocol`, typed signatures) before the work starts. If a contract is wrong, stop and
  report; do not change it on your own.
- Record a design decision that others will live with as a short file in `docs/decisions/`.
- If `main` goes red, revert the commit first, then fix on a branch.

## Working style

- Plain language, concise. Commit messages say what changed and why.
- No pull requests: checked work is pushed straight to `main`, in small, frequent commits.
