# Dev loop review: iterating fast without regressions

Written 22 Nov 2026, from the repository at commit `1a76281` plus the working tree, the four agent worktrees, the GitHub Actions history, and timings measured while seven agents were running. "Verified" means I ran it; "inferred" means I did not.

## A. Diagnosis: the five biggest risks

1. **No tree has ever been green, so nothing is judged.** All 30 recent CI runs failed (`gh run list`). Since `434d2cd` every push failed on knip, because leaf features had no caller yet (incident 3; the CI log shows 32 unused relay files). Local is 23 commits ahead of `origin/main`. `main` has no protection (`gh api .../branches/main/protection` → 404). Every Dependabot PR is red, including the TypeScript 7 bump that TASKS.md flags as unverified.
2. **Worktrees sit inside the repo and start from a stale base.** The Agent tool puts worktrees under `.claude/worktrees/`, which is neither committed nor ignored. Verified effects: `bun run lint` in the main checkout also lints a worktree (12 of the 23 files with errors are under `.claude/worktrees/agent-a498…`). `format:check` aborts with "Found a nested root configuration". `git add -A` would commit the worktrees as embedded repos. Two of the four worktrees are based on `8765b4a`, which is `origin/main` from before the gates existed, so the agents in them build on an empty scaffold and are certain to conflict on `package.json`, `bun.lock` and `docs/status.html`.
3. **Contracts are prose, and the shared files are hot.** The SDK imports `AppType` from the app (`packages/sdk/src/index.ts:2`). depcruise rejects that today (`sdk-no-relay`, 2 errors), and it also ties SDK and UI typechecks to whatever half-written app code exists. Protocol types arrived late (`373885d`, incident 4). `protocol/src/index.ts`, `relay/map.ts` and `relay/names.ts` are changed in the working tree right now by agents working in parallel.
4. **Gates are serial, uncached and whole-repo.** Measured: lint 63 s (no `--cache`), typecheck 6.7 s, deps 1.2 s, knip 1.3 s, jscpd 0.1 s, e2e 9 s for 8 tests (about 1.1 s each, run one after another). The `&&` chain stops at the first failure, so you only ever see one gate's errors. At 40 API tests plus browser tests, `check` will take several minutes, and every agent runs it on every push.
5. **The durable formats have no regression net.** The JSONL event log has no format version (`protocol/src/events/event.ts`). `relay/hello` exchanges version strings, but nothing checks that they are compatible. There is one Drizzle migration and no test that upgrades from an older database. Nothing protects the hidden `ui.git` or the SDK surface that users' UIs depend on. The mock agent is checked against nothing real (TASKS.md "Keep the mock ACP agent faithful" is still open).

## B. Recommendations

Each entry gives the mechanism, what it prevents, its cost and its priority.

### B1. One worktree and one branch per agent, outside the tools' view (P0)
- **Mechanism:** Add `.claude/worktrees/`, `__gate_sample*/` and `.cache/` to `.gitignore`, and `.claude/**` to the eslint `ignores`. Biome then skips them too, through `vcs.useIgnoreFile`. Keep `.claude/settings.json` committed for the hooks in B8.
- **Base:** Before spawning a wave, the orchestrator pushes `main`. The isolation option forked from `origin/main` (evidence: the two worktrees at `8765b4a`). Each brief starts with `git log -1 --format=%h main` so the agent can check its base.
- **Branches:** `agent/<short-task>`. The agent commits small and often on its branch and never pushes `main`.
- **Installs:** The first step in a worktree is `bun install --frozen-lockfile`. Bun's global cache makes it a few seconds; the measured worktree `node_modules` are 16–487 MB, all served from the cache. Agents never edit dependencies or `bun.lock`; they ask for them in their report (B8).
- **Hot spots:**
  - Barrels (`index.ts`) and `names.ts`/`map.ts`: one entry per line, sorted, append-only. Add `packages/*/src/index.ts merge=union` to `.gitattributes`; that is safe for one-export-per-line barrels, and a bad union is still caught by typecheck at integration.
  - `package.json`, `bun.lock`, `knip.json`, `docs/status.html`: the orchestrator owns them. A conflict in `bun.lock` is never merged by hand: take main's copy and rerun `bun install` (B2).
- **Prevents:** incident 1 entirely, incident 6 for other agents' files, and the nested-config lint and format failures.
- **Cost:** 15 minutes.

### B2. A local merge queue: `scripts/integrate.ts` (P0)
- **Outline:** `bun run integrate agent/a agent/b …`
  1. `git worktree add --detach ../ac-integrate main` (a scratch tree, never the shared checkout).
  2. For each branch, `git rebase` it onto the current tip. On conflict, stop and print the files.
  3. If `package.json` changed, run `bun install` and commit `bun.lock`.
  4. Run `bun run check` (B6 parallel version) and record timings.
  5. If green, `git push origin HEAD:main`. That is a fast-forward and is rejected if main moved; in that case loop.
  6. Delete merged `agent/*` branches and print a summary.
- **Batches:** The orchestrator integrates finished branches in small batches (1–3). When a batch is red, it bisects by integrating one branch at a time.
- **Prevents:** incident 2 (main only ever receives trees that passed the full check) and the "ten finished commits stuck" problem, because one agent's red work no longer blocks another's.
- **Cost:** about 1 hour, about 80 lines.

### B3. Always-green main without pull requests (P0 to set up, owner clicks once)
- **CI:** Run on `push` to `main` and `integrate/**` only; drop `pull_request`, except Dependabot (D2).
- **Rule:** Settings → Rules → new branch ruleset for `main`: require linear history, block force pushes and deletions, require status check `check`, and do NOT require a pull request. Bypass list: the owner only.
  - A required status check attaches to the commit SHA. So `integrate.ts` pushes `integrate/<sha>`, waits with `gh run watch`, then fast-forwards `main` to that same SHA, and GitHub accepts the direct push. (Inferred from GitHub's documented per-SHA status behaviour; test it once.)
- **Revert first:** If `main` goes red anyway (for example a flake or a CI-only difference), the orchestrator runs `git revert <sha> && git push` within 15 minutes, before anything else, and the fix lands through B2. Nobody stacks work on red.
- **CI speed:**
  - Split into parallel jobs: `types`, `lint`, `static` (format, deps, knip, dup, audit) and `e2e` (sharded, B5).
  - Cache `~/.bun/install/cache` keyed on `bun.lock`, and `.cache/eslint` keyed on the lockfile plus the eslint config.
  - Dependabot: add `ignore: [{dependency-name: typescript, update-types: [version-update:semver-major]}]` until typescript-eslint supports TS 7, plus `groups` so updates arrive as one weekly batch.
- **Cost:** 1 hour, plus the owner's 2 minutes of clicking.

### B4. Contract first: compiled interfaces and spec tests before agents start (P0 for the next wave)
- **Contract commit:** Before a parallel wave, the orchestrator lands on `main`:
  - (a) zod schemas plus `z.infer` types in `protocol`, and new SDK signatures;
  - (b) the e2e tests for the feature, written as `test.todo("…", async () => { … })` with full GIVEN/WHEN/THEN bodies (verified: `bun test` skips a todo body, and `--todo` runs it and counts a throwing body as "todo", not a failure; tsc still checks the body either way);
  - (c) helper stubs in `e2e/support/` whose bodies throw `new Error("not built yet: <brief>")`.
- **Effect:** Briefs point to file paths instead of pasted code blocks, and drift becomes a type error at integration. The leaf features get callers on day one, so knip stops failing (incident 3) and no throwaway verification scripts are needed. The agent's job is to turn its todos into passing tests.
- **Surface snapshot:** `scripts/contract-snapshot.ts` writes `packages/protocol/contract.json`. It contains every `RelayMethods`/`RelayNotifications` entry and every `SessionEvent` kind, converted with zod 4's built-in `z.toJSONSchema` (no new dependency).
  - CI fails when the file is stale.
  - A diff that removes a property, makes an optional one required, or narrows an enum is "breaking", and the script fails unless `PROTOCOL_VERSION` (new, exchanged in `relay/hello`) is bumped in the same commit.
  - Only the orchestrator edits `contract.json`.
- **Cost:** about 1 hour for the snapshot script; the contract commit is about 30 minutes per wave.

### B5. A fast, trustworthy end-to-end suite
- **Layers by folder** (P1): `e2e/relay/` (JSON-RPC against the daemon, as today), `e2e/api/` (app plus relay through `@agentcontrol/sdk`), `e2e/browser/` (Playwright). Use `bun run test relay|api|browser`. Folder names inside each layer match feature folders (`sessions`, `worktrees`, `files`, `usage`), so B6 can map changes to tests.
- **Parallelism** (P0, 30 minutes): `run-e2e.ts` runs each file in its own `bun test <file>` process, up to `os.availableParallelism()` at once (4 cores here). Separate processes keep the module-level `cleanups` array in `e2e/support/setup/cleanup.ts` safe. Bun's in-file `concurrentTestGlob` (present in 1.4.4's bunfig) would need per-test cleanup first. In CI, shard by file hash with `E2E_SHARD=1/3`.
- **Timing budget** (P1):
  - Run with `--reporter=junit --reporter-outfile=.cache/e2e/<file>.xml`. The runner merges the results into `.cache/e2e-timings.json`.
  - Budgets: relay 2 s, API 4 s, browser 12 s per test. The run fails above 2× budget and prints the 10 slowest tests.
  - Keep the `Timeline` default wait at 3 s.
- **Flakes** (P1):
  - A nightly CI job runs `bun test --rerun-each 20` on the e2e files (both `rerunEach` and `retry` exist in 1.4.4). CI never uses `retry`.
  - Quarantine means moving the test to `e2e/quarantine/` with an entry in `e2e/quarantine.json` (test, reason, date, owner). A separate, non-required job still runs and reports those tests. `check` fails if an entry is older than 7 days or there are more than 3 entries, so a quarantined test cannot be forgotten.
- **Helper conventions** (P1):
  - Every wait goes through `Timeline.waitFor(predicate, plainSentence)`, and on timeout the error lists the last 5 entries.
  - Each domain gets one setup file and one expect file.
  - A new helper is first added to `e2e/support/README.md` (written as a list, not a document).
- **Smoke subsets for the inner loop** (P1): `bun run test --affected` maps changed `packages/<pkg>/src/<feature>/` to `e2e/*/<feature>/`. Changes to `protocol/`, `e2e/support/` or `package.json` run everything.
- **Faithful mock** (P1):
  - `spike/record.ts` drives the real adapters and saves the raw tap from `relay/src/agents/tap.ts` to `e2e/fixtures/recordings/<agent>-<scenario>.jsonl`.
  - A contract test, `e2e/contracts/mock-agent-matches-recordings.e2e.ts`, uses `test.each` over the recordings. It checks that every `sessionUpdate` kind and permission-request shape the mock emits also appears in a recording, and that every recorded kind has a mock step or is listed in `e2e/fixtures/recordings/unsupported.json`.
  - The nightly real-adapter job (B11) re-records and fails on new kinds.

### B6. Fast inner loop: `scripts/check.ts` with `check:quick` and `check` (P0)
- **Parallel:** One script starts every gate with `Bun.spawn` at the same time. It prints one line per gate (pass/fail, seconds) and writes `.cache/check-timings.json`. It shows all failures, not just the first.
- **`check:quick`** (target under 15 s):
  - `tsc -p tsconfig.json --incremental --tsBuildInfoFile .cache/tsc.tsbuildinfo` (incremental works with `noEmit`).
  - `eslint --cache --cache-location .cache/eslint --max-warnings 0 <changed ts files>`, where the changed files are `git diff --name-only --diff-filter=ACMR main...HEAD` plus uncommitted changes.
  - `biome format --changed`, which needs `"vcs": {"defaultBranch": "main"}`.
  - Full depcruise, knip and jscpd (each under 1.5 s, and they need the whole graph).
  - `test --affected`.
- **`check`:** All gates on the full repo in parallel, eslint still `--cache`d, plus the full e2e. `check:ci` adds the nightly flake job.
- **Hooks:**
  - pre-commit: format staged files plus eslint `--cache` on staged files, as now.
  - pre-push: `check:quick` instead of the full typecheck.
  - Integration and CI: full `check`.
  - In a private worktree the hooks only see the agent's own files, so they stop blocking each other.
- **Cost:** about 1 hour. Expected: lint from 63 s to a few seconds on a warm cache (inferred), and `check` time becomes the slowest gate instead of the sum of all gates.

### B7. Behaviour coverage map (P1)
- **Lists:** `scripts/coverage-map.ts` builds the inventory from code, not from docs:
  - `Object.values(RelayName)`;
  - the `kind` literals of `SessionEvent.options`;
  - the Hono app's `.routes` (method plus path);
  - the keys of `createClient({baseUrl:""})`, walked recursively;
  - the exported components in `packages/ui-template/src/**/*.tsx`.
- **What ran:** An opt-in trace, `AGENTCONTROL_TRACE=<file>`, makes the relay dispatcher, the event-log writer and the Hono middleware each append one line (`method relay/prompt`, `event turn-ended`, `route POST /api/sessions`). This lives at the edges only. The e2e runner sets it per test and joins the traces. This measures what actually ran, not what a helper mentions.
- **Output:** `.cache/coverage-map.json` plus a table.
  - Gaps are allowed only if listed in `e2e/coverage-gaps.json`, and that list may only shrink, like the lint limits.
  - Start in report-only mode for one day, then make it fail the check.
- **Prevents:** incident 9. It also feeds B10.

### B8. Guardrails against the incidents (P0)
- **Agent guard hook:** In `.claude/settings.json`, add a `PreToolUse` hook on `Bash` that runs `.claude/hooks/guard.ts`. The script reads the tool input JSON and exits 2 with a reason on:
  - `git add -A|--all|.` (stage named paths only);
  - `biome … --write` without `--changed` or explicit paths;
  - `bun add|remove|update` and `bun install <pkg>`;
  - `git push … main` and `git commit --no-verify`.
  This covers incidents 1 and 6, and the gate sample that was nearly committed.
- **Format script:** `format` becomes `biome format --write --changed`; a new `format:all` is for the orchestrator only.
- **`prove-gates`:** It creates `git worktree add --detach $(mktemp -d)` and writes the bad samples there, never in the working tree (today `scripts/gates/types.ts:11` writes into `packages/relay/src/`).
- **Dependencies through one door:** `bun run add-dep <pkg>@<ver> <workspace>` (`scripts/add-dep.ts`):
  - checks the package against the Approved list parsed from AGENTS.md;
  - fetches registry metadata: last release within 12 months and older than 14 days (matches `minimumReleaseAge`), license in an allowlist, number of dependencies;
  - runs `bun add --exact`, then `bun audit`, then a license sweep of `node_modules/**/package.json`, and prints how many transitive packages were added.
  - A CI `deps-policy` job repeats the approved-list and license checks. Only the orchestrator runs it. This covers incident 7.

### B9. Definition of done that a machine can check (P0)
- **`bun run done --owns <paths>`** (`scripts/done.ts`):
  - runs `check`;
  - asserts a clean tree, a branch rebased on `main`, and changed files inside `--owns` (or listed as requested shared edits);
  - asserts every changed `src` feature has a changed or new `*.e2e.ts`, no `test.todo` remains in owned e2e folders, and a decision file was added or "Decisions: none" was given;
  - prints one fenced `DONE-REPORT` JSON block: branch, commits, gates with seconds, tests added, coverage-map delta, dependency requests, decisions. The orchestrator parses that block instead of prose.
- **Brief template** (`docs/briefs/TEMPLATE.md`, 20 lines):
  - goal in one sentence;
  - owned paths;
  - shared files allowed (append-only);
  - contracts by path (from B4);
  - todo tests to make pass;
  - commands: `bun install --frozen-lockfile`, `bun run check:quick`, `bun run done --owns …`;
  - a forbidden list (B8);
  - the report format.
- **Decision log:** `docs/decisions/NNNN-short-title.md` with five lines: context, decision, options rejected, consequence, date and author. The agent writes it in its branch, so it merges with the code (incident 10).

### B10. Status page generated from the repo (P1)
- **Data:** Each component in `docs/status.html` gets `e2e:"e2e/api/sessions"` and keeps its hand-written name and description. `scripts/status-data.ts` (run by `integrate.ts`) rewrites only the `DATA` block, filling in:
  - status: done if the path exists, every test in its e2e folder passes and no todos remain; in progress if todos remain;
  - test counts;
  - the coverage-map share and line coverage from B12;
  - the last commit;
  - the CI badge for `main`.
- **Prevents:** The hand-written page has already drifted. It lists `packages/relay/src/acp` and `src/log`, which don't exist (the folders are `agents/` and `event-log/`), and it marks "Quality gates and CI" done while every CI run fails.

### B11. Regression nets for this product's durable state (P1, release-blocking)
- **Event log:**
  - Golden logs in `e2e/fixtures/event-logs/v1/*.jsonl` are copied from real relay runs, including one with a truncated last line, and are never edited.
  - Test: a relay started on a data folder seeded with them lists the sessions, `events.subscribe` after N returns the rest, and the app syncs them.
  - Add a `v` field to new events only through a new folder `v2/` plus a test that `v1` still loads.
- **JSON-RPC:** B4's snapshot plus `PROTOCOL_VERSION` in hello. Test: "an app with an older protocol version is told to update the relay" (needed by phase 5 anyway).
- **SQLite:**
  - `scripts/db-fixture.ts` creates `e2e/fixtures/state-db/<migration-tag>.db` with seed rows after each migration.
  - Test (`test.each` over the fixtures): the app starts on each one and the SDK shows the seed data.
  - CI fails if `packages/app/drizzle/` has a migration without a fixture, and runs `drizzle-kit check`.
- **SDK promise:** `tsc --declaration --emitDeclarationOnly` on `packages/sdk` is compared with the committed `packages/sdk/api.d.snapshot`; a removal or narrowing fails unless the SDK major version changes. Each released default UI is kept in `e2e/fixtures/ui-releases/<ver>/` and typechecked against the current SDK.
- **Hidden UI history:** The plan's test (a user change and a template change to the same file both survive an update), plus fixture `ui.git` repos from each release that must upgrade cleanly. This also covers `isomorphic-git` bumps.
- **Release** (P2):
  - `scripts/smoke-binary.ts` (already started in a worktree): `bun build --compile`, start the binary with a temp `HOME` and the mock agent, start one session through the SDK, then stop.
  - CI runs it on tags and nightly on `macos-14` (arm) and `macos-13` (intel).
  - Nightly real-adapter job: `e2e/real/*.e2e.ts`, excluded from `bun test`, runs with API-key secrets on a tiny repo, re-records (B5) and runs `gh issue create` on failure.

### B12. Real code coverage from the end-to-end tests: what Bun can do (owner's question)

**What `bun test --coverage` offers in 1.4.4.** Verified in a scratch project outside the repo:
- Reporters: `--coverage-reporter=text` and/or `lcov`, and `--coverage-dir`. It reports functions % and lines %; there is no branch column.
- bunfig `[test]` keys that are accepted and take effect: `coverageThreshold = { lines = 0.9, functions = 0.9 }` (exit code 1 when missed, with no explanation printed), `coveragePathIgnorePatterns = ["glob"]`, `coverageSkipTestFiles = true`.
- Keys also present in the 1.4.4 binary but not tried: `coverageReporter`, `coverageDir`, `coverageIgnoreSourcemaps`, `statements`.
- **No per-file thresholds:** `coverageThreshold = { "src/lib.ts" = { lines = 0.9 } }` was silently ignored (exit 0 on a 50% file). The threshold applies to "All files" only.

**Only the test process is measured.** Verified:
- A module run in a `Bun.spawnSync` child did not appear in the report.
- `bun --coverage file.ts` runs and silently produces nothing.
- `NODE_V8_COVERAGE=<dir>` writes nothing (Bun runs JavaScriptCore, not V8), and `BUN_COVERAGE=1` does nothing.
- On our real suite, the 92% "All files" covers only `protocol`, `sdk` and e2e helpers. There are **zero relay or app files** in the report, so the number is meaningless today.

**One workaround works, with limits.** Verified:
- A child launched as `bun test --coverage --coverage-reporter=lcov --coverage-dir=<d> wrapper.wrap.ts` writes its own lcov when the wrapper's test finishes. The wrapper imports the daemon and awaits a promise resolved on SIGTERM.
- Limits:
  - it prints `bun test v1.4.4` to **stdout**, which breaks stdio JSON-RPC (the `--stdio` bridge, the ACP mock agent);
  - `process.exit()` inside it loses all coverage (no lcov written);
  - the child also applies the root bunfig threshold;
  - the per-process lcov files must be merged by a script.
- It is usable for the socket daemon only if the daemon stops by returning instead of calling `process.exit`. That is a hack to keep in reserve, not the main design.

**Design for us: in-process mode plus a few true-process smoke tests.** Inferred, not built:
- **How it works:**
  - `e2e/support/setup/` gets `startRelayInProcess()` and `startAppInProcess()`. They import only package entry points (`@agentcontrol/relay`'s `runDaemon`, the app's start function). depcruise's `feature-internals-from-elsewhere` already allows imports of a package root `index.ts`, and knip then sees these exports as used.
  - The functions must take `{dataDir, env, now}` as parameters and return `{stop()}` instead of reading `process.env` or calling `process.exit`. That matches AGENTS.md "injected edges".
  - The mock agent stays a subprocess. It is the fake, and its coverage does not matter.
  - The mode is selected per layer: `relay` and `api` tests run in process by default, and a `@process` folder `e2e/process/` keeps 5–10 tests on real subprocesses: relay restart, app close and reopen, stdio bridge framing, crash of an agent, the compiled binary (B11).
- **Fidelity lost:** process isolation (shared globals, `cwd`, signal handlers, leaked timers between tests in one file), real stdio framing, and the "daemon survives the app" behaviour. The subprocess folder exists exactly for those.
- **Speed gained:** A bare Bun start is about 8 ms, but loading the relay's module graph takes about 220 ms (measured with `bun -e 'await import(".../daemon/index.ts")'`). A test now pays that for the bridge, the daemon and the stop command, about 0.6 s of the measured 1.1 s per test. In process, the graph loads once per file, so expect about 2× faster API and relay tests (inferred).

**Recommendation** (P1, after B5's parallel runner):
- Commands: `bun run test:coverage` runs `bun test --coverage --coverage-reporter=lcov --coverage-reporter=text --coverage-dir=.cache/coverage` over the in-process layers.
- bunfig `[test]`: `coverageSkipTestFiles = true`, `coveragePathIgnorePatterns = ["e2e/**", "scripts/**", "spike/**", "packages/ui-template/**"]`, and `coverageThreshold = { lines = <floor>, functions = <floor> }`, where `<floor>` is the first measured value rounded down to 5 points.
- **Ratchet:** `scripts/coverage-ratchet.ts` parses the lcov, computes lines % per package, and compares it with the committed `coverage-baseline.json`. It fails if any package drops more than 0.5 points. When coverage rises, `integrate.ts` rewrites the baseline upward (only the orchestrator commits it), and bunfig's global floor is raised to match. Coverage never goes down.
- **CI:** The `e2e` job uploads `lcov.info` as an artifact and prints the per-package table in the job summary (`$GITHUB_STEP_SUMMARY`).
- **Status page:** B10 adds lines % per package next to the coverage-map share. UI coverage is out of scope until the browser layer exists.

## C. Order of work

**Next hour** (orchestrator only, no agent interrupted):
1. B1's ignore lines (`.gitignore`, eslint `ignores`). This fixes lint and format in the main checkout at once.
2. Push the local `main` so new worktrees start from current code. `main` has never been green, so nothing is lost. The always-green rule starts at the first green integration.
3. B8's guard hook and the `format --changed` script, so newly spawned agents are fenced.
4. B9's brief template and `DONE-REPORT` format (text only) for the next briefs.
5. Ask the owner for the B3 ruleset and the D1/D2 decisions.

**Today:**
- B2 `integrate.ts`, then run every finished branch through it until the first green `main`.
- B6 parallel `check` with caches.
- B3 CI split, caches and Dependabot ignore.
- B5 file-parallel runner and junit timings.
- B4 contract snapshot, used for the next wave.

**This week:**
- B7 coverage map.
- B10 generated status.
- B11 golden event logs, migration fixtures and SDK snapshot.
- B5 layers, flake job, recordings and mock contract test.
- B12 in-process mode and the coverage ratchet.
- B8 `add-dep`.
- The decision log, starting with the decisions in D.
- Binary smoke and the nightly real-adapter job (by the end of the week).

## D. To discuss with the owner

**D1. The SDK may import the app's route types.** The plan picks Hono's typed client, and that only works with `import type { AppType } from "@agentcontrol/app"`. The depcruise rule `sdk-no-relay` forbids that import and fails today. The proposal is to allow type-only imports of the app's root `index.ts` from `sdk`, using `dependencyTypesNot: ["type-only"]` on that one rule. This is not loosening a limit; it makes the rule match the architecture the plan chose. The other option is to restate every route as zod in `protocol` and give up Hono's inferred client, which means more code and more chances for drift.

**D2. "No pull requests" and Dependabot.** Dependabot only works through PRs, and all of its PRs are red and unmerged. Either allow bot PRs that the orchestrator merges after CI passes (the only PRs in the repo), or turn Dependabot version updates off and run a weekly `bun outdated` plus `add-dep` task. Security alerts work either way. The plan's table also says "no direct push to main", which contradicts the rule; B3's ruleset (direct push allowed, but only for SHAs that passed CI) satisfies both.

**D3. Git hooks for agents.** With B2 and B3 as the hard line, the hooks give agents a second, slower copy of the same checks and blocked finished work on a shared checkout (incident 1). Proposal: keep only the formatting pre-commit hook, and make pre-push run `check:quick`. The real gate is the integration run plus CI.

**D4. In-process e2e (B12) is still end-to-end?** The tests still drive the real relay and app through their public JSON-RPC and HTTP surfaces with only the agent faked. They just skip the process boundary, which keeps its own smoke folder. It buys about 2× speed and real coverage. It needs the owner's yes, because it changes what "every test starts the real app and relay" means.
