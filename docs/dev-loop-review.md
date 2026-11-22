# Dev loop review

Written 22 Nov 2026 from the repo as it stands (about 4,900 lines of TypeScript, 8 e2e tests, 12 commits).
Gates were not run (tree in flux), so timings are "measure first". No rule from AGENTS.md is loosened.

## A. Diagnosis: the five biggest risks

1. **One shared checkout: one agent's mess is everyone's failure.** `typecheck` is one program over
   `packages/*/src`, `e2e`, `spike`, `scripts` plus a second one for `ui-template` (`package.json`);
   lint, knip, deps and dup scan the whole tree too. Incidents 1, 2 and 6 follow from this. Right now
   about 15 untracked ui-template paths and modified `bun.lock`, `package.json`, `knip.json` belong to
   someone else. It worsens with every added agent.
2. **Nothing judges an integrated tree.** `ci.yml` has never run on real code, and has likely problems:
   Bun pinned at 1.4.4 while `@types/bun` is 1.4.5, no Playwright browser install, `bun audit` hitting
   the network each run, gitleaks-action needs a licence key for organisation repos, and it triggers on
   both `push` and `pull_request`. `lefthook` is installed in `.git/hooks` but no `prepare` script
   exists, so fresh clones have no hooks.
3. **Contracts live in chat, not in the repo** (incidents 3 and 4). The compiler is the only referee
   that works across parallel agents, and it is used only after the fact.
4. **The e2e suite will get slow and flaky, and "tests run in parallel" is not true yet.**
   `scripts/run-e2e.ts` runs one `bun test` over all files; files run one after another. Each test
   spawns a relay daemon, a mock agent and a git repo (`e2e/support/setup/start-relay.ts`). At 40+
   tests, behind serial typecheck, type-aware eslint, knip, jscpd and audit, that is minutes per commit.
   No timing, cache, flake detection or "run only my tests".
5. **Long-lived formats have no regression net.** The JSONL event log, the JSON-RPC method set
   (`packages/protocol/src/relay/map.ts`), the SQLite schema and the SDK are promises to old data and
   to user-modified UIs. Every test starts from an empty data folder, so a change that cannot read
   yesterday's log or database passes `bun run check`. The mock agent is never checked against the
   real adapters (TASKS.md "Keep the mock ACP agent faithful").

Smaller: `stage_fixed: true` in `lefthook.yml` re-stages whole files in a shared index; `prove-gates.ts`
writes broken samples into the real tree; `bun audit` as a gate depends on today's advisories, not our change.

## B. Recommendations

### B1. Isolate parallel agents (P0)
One git worktree and branch per agent, made by a script; agents never touch the main checkout.
```
scripts/agent-worktree.ts <name>
  git fetch origin && git worktree add ../ac-wt/<name> -b agent/<name> origin/main
  cd ../ac-wt/<name> && bun install --frozen-lockfile     # node_modules is gitignored: each needs its own
  write .agent-owned.json {"paths": ["packages/relay/**", "e2e/relay/**"]}   # gitignored
```
- Bun reuses its global cache, so the second install should take seconds. Measure once.
- The Agent tool's `isolation: "worktree"` fits: temporary worktree and branch per subagent. Gaps for the
  brief: the first command is `bun install --frozen-lockfile`, and the branch must be findable by `land`.
  Otherwise use the script. Hooks live in the shared `.git/hooks`, so they work in worktrees.
- Agents commit freely on their branch; a neighbour's half-written files are invisible.
- `bun.lock` and dependency keys: agents never edit them (B7). Shared files (`knip.json`,
  `eslint.config.js`, `docs/status.html`) are orchestrator-only.
- Merge: `scripts/land.ts` (B2). A conflict is resolved by the owning agent with `git rebase origin/main`.
- Prevents incidents 1 and 6. Cost: an hour. Start with the next brief; do not move running agents.

### B2. Always-green main without pull requests (P0 local, P1 CI)
**A (P0, no GitHub clicks): serialised local landing.**
```
scripts/land.ts <name>
  flock .git/land.lock                                   # one landing at a time
  git fetch && git rebase origin/main                    # on conflict: stop, tell the agent
  bun run check (full, in the agent's worktree)          # the real gate, on the merged result
  git push origin HEAD:main                              # fast-forward only; refetch and retry once
  append sha, agent, seconds to docs/landings.log
```
**B (P1): CI judges, still no PRs.** Push to `queue/<name>`; `ci.yml` runs on `queue/**` and `main`, a last
job promotes the green SHA:
```
on: { push: { branches: ["main", "queue/**"] } }       # drop pull_request
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }   # plus timeout-minutes: 20
promote: if startsWith(github.ref,'refs/heads/queue/'); needs: [check, e2e, gitleaks]
  steps: checkout (fetch-depth 0, contents:write); git merge --ff-only $GITHUB_SHA; git push origin HEAD:main
```
- **Owner clicks** (Settings > Rules > Rulesets, target `main`): require status checks `check`, `e2e`,
  `gitleaks`; require up-to-date branch; block force pushes; restrict deletions; do NOT require a pull
  request; add the GitHub Actions app to the bypass list. Test with one commit: GitHub accepts a direct push
  when that exact SHA already has the required checks green. If it does not, keep A as the gate and use the
  ruleset only for force pushes and deletions.
- **Revert-first:** when `main` is red, the first action by whoever sees it is `git revert <sha>`, landed
  at once. Then the author fixes forward on their branch. Nobody debugs on `main`; never force-push.
- **Fix the workflow now (P0):** run `bun run check` on a clean clone of the scaffold, then fix the problems
  listed in A2, cache `~/.bun/install/cache`, and split `audit` into its own job (B7).
- Cost: A under an hour; B half a day plus clicks.

### B3. Contract-first parallel work (P0 convention, P1 tooling)
- Before any parallel brief, a **contracts commit** lands on main with only compiled interfaces: zod
  schemas plus exported inferred types in `protocol`, SDK signatures with `throw new Error("not
  implemented")` bodies, mock-agent step names. The brief marks them read-only; a problem means stop and
  report. Put the Hono route table in `protocol` as a zod-typed object imported by both app and SDK.
- **Conformance by the compiler:** relay handlers typed `{ [M in RelayMethodName]: (p: RelayParams<M>) =>
  Promise<RelayResult<M>> }` and event handlers `Record<EventKind, Handler>`: a missing or drifted method
  is a `tsc` error. Same for app routes.
- **Consumer-driven:** the contracts commit also holds the e2e specs as `test.todo("...")` titles, one per
  behaviour in the brief. The coverage map (B5) lists them as "specified". Callers and leaves can be
  built in either order.
- **Leaf before caller:** a leaf is done only with an e2e test through the nearest real entry point
  (relay: JSON-RPC via `relay-client`; app: SDK). Minimal wiring lands in the same branch, so knip stays
  strict and never sees a long-lived unused export.
- **Drift guard (P1):** `scripts/contracts-check.ts` compares `tsc --declaration --emitDeclarationOnly`
  output of `protocol` and `sdk` with committed `contracts/*.d.ts` snapshots. Additive changes pass
  (new optional field, new method); removals and narrowing fail unless the commit adds a decision file (B8).

### B4. Fast, trustworthy e2e-only (P0 to P1)
Three levels inside e2e, same style and helpers: `e2e/relay/` (daemon, JSON-RPC, mock agent; most tests,
budget 2 s each), `e2e/api/` (app plus relay through the SDK, 4 s), `e2e/browser/` (Playwright, one per
user journey, 15 s). The harness records each test's duration; the runner fails a test over 3x budget.
- **Parallelism (P0):** replace `scripts/run-e2e.ts` with a runner taking `--shard i/n`, `--only <path>`
  and `--changed`, running one `bun test` process per group via `os.availableParallelism()`. Also try
  `bun test --concurrent`. Tests already use their own `tmpdir()` data dir and repo; add a `freePort()`
  helper and grep for fixed ports.
- **Inner-loop subsets:** tests live in `e2e/<feature>/`; briefs name theirs: `bun run test --only
  e2e/worktrees`. `--changed` maps source folders to e2e folders via `e2e/areas.json`; an unmapped change
  runs everything. Full suite only in `land` and CI.
- **Flake detection (P1):** CI job `e2e-repeat` (nightly, and on `queue/**` when e2e files changed) runs
  `bun test --rerun-each 5` on changed files; any inconsistency fails. **Quarantine that hides nothing:**
  the test moves to `e2e/quarantine/`, still runs in its own reported CI job, has an owner and a 7-day expiry
  in its header, and the build fails when the expiry passes. Never retry-until-green.
- **Conventions (add to AGENTS.md):** helpers wait for events with a timeout message naming the awaited
  fact; a helper used once stays in the test's folder; `scripts/gates` gains a case forbidding `setTimeout`
  and `Bun.sleep` under `e2e/` (AGENTS.md bans sleeps; only style rules guard it today).
- **Mock faithfulness (P1/P2):** `scripts/record-session.ts` wraps `spike/run-session.ts` and saves a real
  Claude Code or Codex session to `e2e/fixtures/recordings/<adapter>/<scenario>.jsonl`; the mock can replay
  it (`mockAgent.replays("claude-permission-flow")`). Nightly contract test with API keys: run the same
  scenario on the real adapter and compare the shape (method names, update kinds, field names, not text)
  with the recording. A shape change means the adapter changed: update recording and mock deliberately.

### B5. Behaviour coverage map without unit tests (P1)
`scripts/coverage-map.ts` (about 120 lines, no dependency) takes behaviours from code that is already
data and searches `e2e/` for each: keys of `RelayMethods`; `RelayNotifications` and the event-kind enum
(`packages/protocol/src/events`); app routes (route table, B3); exports of `packages/sdk/src/index.ts`;
`ui-template` feature folders against test ids in `e2e/browser`.
- Output: `docs/coverage.json` and a table. `--strict` fails on any item without a test reference that
  is not in `e2e/coverage-waivers.json` (reason and expiry each). Report-only first; strict per package
  once clean. `test.todo` counts as "specified".
- Upgrade from "referenced" to "exercised": helpers call `covers("relay/prompt")`, and relay and app write
  each dispatched method to `$AGENTCONTROL_COVERAGE_DIR/<pid>.json` when set (one line in the dispatcher);
  the runner merges. Runtime, cross-process, no tooling. Real line coverage in spawned children via
  `NODE_V8_COVERAGE` is uncertain on Bun: timebox one hour, P2.

### B6. Fast inner loop (P0 to P1)
- **`scripts/check.ts` (P0):** runs each gate as a named step, prints seconds, writes
  `.check-timing.json`, runs independent gates in parallel (typecheck, lint, format, deps, knip, dup, audit
  only read files); tests start after typecheck. Time falls to roughly the slowest gate.
- **`check:quick`** (before each commit, scoped to `.agent-owned.json`): eslint on owned changed files,
  incremental tsc, deps, format check, the area's e2e subset. No knip, jscpd, audit. **`check`**: everything,
  used by `land` and CI.
- **Caching (P0):** `tsc --incremental --tsBuildInfoFile node_modules/.cache/tsc/<name>.tsbuildinfo`;
  `eslint --cache --cache-location node_modules/.cache/eslint` (keep `--max-warnings 0`); `depcruise
  --cache`; `knip --cache`. Per worktree, no rule changes.
- **Affected-only (P1):** `git diff --name-only origin/main...HEAD` feeds eslint and the e2e area table.
  Past about 20 s of typecheck, split into per-package tsconfigs and use `tsc -b`.
- **Hooks, given frequent commits:** pre-commit = format and eslint on staged files only (under 10 s),
  drop `stage_fixed` (or fail with a message). Pre-push = `check:quick` for the pusher's paths instead of
  whole-repo typecheck (fixes incident 1's blocked push). CI and `land` = everything. Add
  `"prepare": "lefthook install"`. Never run the full e2e suite in hooks.

### B7. Guardrails against the incidents (P0)
- **Scoped format (incident 6):** `format` becomes `bun scripts/format.ts <paths>`, which refuses to run
  with no paths or paths outside `.agent-owned.json`.
- **No `git add -A`:** worktrees remove the cause. Also a `.claude/settings.json` deny list for
  `Bash(git add -A*)`, `Bash(git add .*)`, `Bash(git commit -a*)`, `Bash(git reset --hard*)`,
  `Bash(git push --force*)` for subagents, and a line in the brief template.
- **prove-gates:** run it only in its own worktree until it can work in `os.tmpdir()`.
- **One door for dependencies (incident 7):** `scripts/add-dep.ts <pkg> <version> [--dev] --for <package>`,
  run only by the orchestrator on the integration worktree: checks the approved list (turn AGENTS.md's
  "Approved" paragraph into `docs/approved-deps.json`), `bun add --exact`, `bun audit`, licences, `bun run
  knip`, commits `package.json` and `bun.lock` together, lands. Agents rebase. A pre-commit check fails a
  commit on an agent branch that touches `bun.lock` or a `dependencies` key.
- **Licence check with no dependency:** `scripts/licenses.ts` reads `bun.lock`, then each
  `node_modules/<pkg>/package.json` `license`, and fails on anything outside an allow list (MIT, ISC,
  BSD-*, Apache-2.0, 0BSD, plus dev-only copyleft AGENTS.md permits) or with no licence field.
- **Audit stability:** own CI job, nightly, and in `land` only when `bun.lock` changed. Overrides stay the
  fix, each with a one-line decision file.

### B8. Definition of done, briefs, decisions, status (P0 to P1)
- **`scripts/done.ts` (P0)**, run last by the subagent, prints a block pasted verbatim into the report:
  ```
  DONE-REPORT v1  branch: agent/relay-fs  base: <sha>  head: <sha>
  files-outside-owned-paths: 0     check-quick: pass 41s     e2e-area: pass 12 tests 18s
  new-e2e-tests: 3   test.todo-left: 0   knip-unused: 0   eslint-disables-added: 0   limits-changed: no
  deps-changed: no   contracts-changed: none|additive|breaking   decisions: docs/decisions/0007-x.md
  ```
  The orchestrator rejects a report without it; `land.ts` re-runs the checks, so landing is the proof.
- **Brief template** `docs/brief-template.md` (P0): goal; owned paths; read-only contracts; e2e behaviours as
  `test.todo` titles; verification commands (`check:quick`, `test --only`, `done.ts`); do-nots (deps, other
  folders, limits, `git add -A`); stop-and-report on contract problems; report format.
- **Decision log (P0):** `docs/decisions/NNNN-title.md`, 10 lines: context, decision, alternatives rejected,
  cost to reverse. Written when a subagent picks between designs, adds an override, or changes a protocol
  type. `done.ts` fails if the diff touches `packages/protocol/src` or a `package.json` with no new decision
  file. `land.ts` assigns `NNNN` so parallel branches do not clash.
- **status.html from data (P1):** `scripts/status-data.ts` writes `docs/status-data.json` per component:
  gate results from `.check-timing.json`, e2e counts from `bun test --reporter=junit`, coverage % from B5,
  last landing from `docs/landings.log`. `land.ts` regenerates it; `status.html` reads it and keeps only
  hand-written text. A component shows "done" only when its coverage map has no uncovered items.

### B9. Regression safety for the risky areas (P1; golden files first)
- **Event log:** `e2e/fixtures/logs/v1/<scenario>.jsonl`, produced once from a real relay run with the mock
  agent (`scripts/bless-fixtures.ts`, explicit). Test: copy it into a fresh data dir; the current relay
  reads it and resumes after seq N. A format change adds `v2/` and a tolerant reader; `v1/` is never
  replaced. A second test replays a scripted turn and compares the produced log, ids and timestamps
  normalised, with the golden file.
- **JSON-RPC versioning:** add `protocolVersion` to `relay/hello`; rule: additive within a major; removing or
  retyping needs a bump and a decision file. Enforced by the B3 snapshot plus a test that recorded `v1`
  request files (`e2e/fixtures/rpc/v1/*.json`) still parse with current schemas.
- **SQLite migrations:** for each migration N, a fixture database built by running migrations to N and
  inserting rows (`scripts/bless-fixtures.ts` generates, so the matrix grows by itself). Test: start the
  app on each, assert rows survive and the SDK returns them. Also test the `state.db` backup before upgrade
  (TASKS.md).
- **SDK promise:** B3 snapshot plus one frozen old default UI (`e2e/fixtures/ui/v1/`) built and driven by
  one browser test against the current app. Failing means: bump the SDK major and give the Modify agent a
  migration.
- **Hidden UI git:** e2e through the app API on a fixture `ui.git` (built by script, not committed as a
  binary): upstream with 2 releases, main with 3 Keeps; update default UI; assert history kept, `upstream`
  holds only release commits, conflicts reach the Modify flow, Undo works.
- **Release (P2):** smoke test of the `bun build --compile` binary (temp data dir, `relay/hello`, one mock
  turn). Nightly `schedule:` job on the real adapters (keys in secrets) running the B4 contract test;
  failures open an issue, they do not block landing.

## C. Order of work

**Next hour (running agents are not touched):**
1. Write `scripts/check.ts` (new file, timings, parallel). Run it in a throwaway worktree on a clean clone
   of the scaffold commit and fix `ci.yml` accordingly (B2). Answers incident 2.
2. Write `scripts/agent-worktree.ts` and `docs/brief-template.md`; use them for the next brief only.
3. AGENTS.md paragraph: no `git add -A`, no whole-repo `--write`, deps only via orchestrator, revert-first,
   decision files.
4. `.claude/settings.json` deny list (B7).
5. `"prepare": "lefthook install"` and pre-push moved to owned-paths typecheck (B6); `lefthook.yml` has no owner.
**Today:** `scripts/land.ts`; integrate the in-flight work through it one branch at a time so `main` gets a green tree (B2A); cache flags (B6); e2e runner with `--only` and sharding
(B4); `scripts/done.ts` and `docs/decisions/` (B8).
**This week:** ruleset clicks and the `promote` job (B2B); nightly audit and flake jobs; `coverage-map.ts`
report-only then strict (B5); contracts snapshot (B3); golden log, RPC and migration fixtures with the first
test of each area (B9); `add-dep.ts`, `licenses.ts`; status data (B8); prove-gates out of the tree.
**Later (P2):** adapter recordings and nightly contract test, binary smoke test, tsconfig references.

## D. To discuss with the owner

1. **"No pull requests" and a judged main.** It works only with a staging branch (`queue/*`) that CI judges
   before a fast-forward. That is not a pull request, but it is a review point the owner may not have meant.
   Fallback is local serialised landing plus revert-first: weaker, since no clean machine sees the build
   before `main` moves.
2. **knip at zero and jscpd at 1% against leaf-first work.** Right for the end state, awkward in parallel
   work. I keep both limits and change the workflow (leaf and wiring land together). If that is too
   constraining, run knip only in `land` and CI, not in every commit: a "when" change, not a limit change.
3. **`bun audit` as a hard gate on every landing.** It tests the advisory list, not our change, and broke the
   build twice. Proposal: block only when `bun.lock` changed, otherwise nightly.
4. **Dependabot without pull requests.** Its output is PRs. Allow bot PRs as the single exception (merged by
   the orchestrator), or drop it and rely on nightly audit plus a weekly `bun outdated` report.
5. **No unit tests, and pure logic.** The plan works inside the rule. The cost sits in diff merging, event
   replay, the permission state machine and git index handling, where failures show as slow, opaque e2e
   failures. A narrow exception ("pure functions with no IO may have a table-driven test file beside
   them") would be the biggest speed gain available, at the price of a second test style. Fine to refuse if
   B4 and B9 are done; flagged because it is the largest single lever.
6. **Size limits and data files.** Drizzle migrations, fixtures and recorded logs will not fit 200 lines or
   jscpd. Exclude `e2e/fixtures/` and the migrations folder by path from `max-lines`, jscpd and biome, as
   data, without touching limits for code. Needs a yes, since AGENTS.md says limits never loosen.
