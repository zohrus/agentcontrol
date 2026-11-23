# AgentControl: tasks for later

Items we found while reviewing the plan (22 Nov 2026, brought up to date 23 Nov 2026, 14:30 UTC) and chose not to put in it yet.
Each one should become a plan change, a roadmap task, or a decision when its time comes.
The plan (`docs/plan.html`) holds the roadmap and the open questions; this file holds the long tail.
Detailed progress per component is on the live status page: https://claude.ai/artifact/A88MyfyQ1j1KEUSjRidmRU (also `docs/status.html`).

## Before the repository exists
- [x] Create the GitHub repo (`zohrus/agentcontrol`), then commit the plan as `docs/plan.html`.
- [x] Update the handoff `CLAUDE.md`: working name (AgentControl), macOS only, MIT, MVP roadmap, git-based UI updates, quality rules and dependency list. Then turn it into `AGENTS.md` plus a one-line `CLAUDE.md` that imports it.
- [ ] Final name. "AgentControl" / `agentcontrol` is a working name only ("Agent Control" is taken). Ideas so far: AgentZ, Hill Sphere / Hill, Minimoon, Saturn, Constellation, AgentOrbit.
- [ ] Before the first public release: rename everywhere (`@agentcontrol/sdk`, `~/.agentcontrol/`, `AGENTCONTROL_PORT_BASE`, `AgentControl.dmg`, cask), then claim the npm scope, Homebrew cask name and a domain.

## Security (deferred)
- [x] Owner asked what this is (22 Nov 2026), approved it, and it landed the same day (next item).
- [ ] Optional, to close the case "any local process that can reach the port can read the token from the served page": hand the secret only through a one-time launch URL opened by the menu bar app.
- [ ] Verify on a Mac that the menu bar app sends the token (`SessionPoller.swift` reads `api-token` under `$AGENTCONTROL_HOME` or `~/.agentcontrol`; never built; it will not see a `--data-dir` given only to the server).
- [x] Lock down the local server (22 Nov 2026): `127.0.0.1` only, Host and Origin checks, a random token per start sent as a bearer header (the UI reads it from a meta tag the app puts in its pages; no cookie), and the UI reloads once when the token changes after a restart. See `docs/decisions/2026-11-22-local-server-security.md`.
- [x] Preview pages cannot reach the API, the token or other sessions (sandbox, ticket, CSP; `docs/decisions/2026-11-22-preview-sandbox.md`). Known gaps: a browser too old to send `Sec-Fetch-Dest`; a symlink in the worktree to a nested repository's `.git`; files that a repo's copy-files setting adds under names other than `.env*`, `.npmrc` and `.netrc` are not refused by `relay/fs.readBytes`.
- [x] Relay socket: readable only by the owner (`0600`), so other users on the machine can't drive your agents. (Set in `packages/relay/src/daemon/server.ts`; still check the folder permissions on shared SSH workspaces in phase 5.)

## Sessions and git
- [ ] How work leaves a worktree: commit, push the branch, open a PR, then archive. Open question: `gh` on the workspace with its own login, or the GitHub API from the app with a token in the keychain. Proposed shape: one relay feature (`publish/`) with `relay/git.commit`, `relay/git.push`, `relay/pr.create`; no interface for other git hosts.
- [ ] Sessions started outside the app (`claude` run in a terminal): show them (e.g. via hooks, as Emdash does) or ignore them.
- [ ] External trajectories (sessions recorded elsewhere): read-only viewing, or resumable? Imported by the app (cloud trace systems) or by the relay (agent logs in `~/.claude/projects`, `~/.codex/sessions`)? Decide before building; read-only sources would become extra workspaces in the app.
- [ ] Previewing an agent's dev server: forward its port over SSH and open it from the session.
- [ ] Prompt input: images, `@file` references, slash commands. Both adapters advertise `image` and `embeddedContext` prompts; check slash commands (`available_commands_update`).
- [ ] Real Claude Code always runs in Manual mode (`docs/decisions/2026-11-23-claude-code-manual-mode.md`). Users who want `auto` for their own sessions need a per-session setting. If an adapter stops offering a mode named `default`, nothing is switched and nothing says so: revisit then.
- [ ] The relay accepts a `model` on `relay/sessions.create` and drops it. Pass it through when the model picker is wired (use the config option of category `model`).
- [ ] Codex retries network errors for a long time without failing. Give turns their own timeout in the relay.
- [ ] Use `session/resume` (no replay) instead of `session/load` when resuming an agent; never append replayed messages to the event log.

## Workspaces and the relay
- [x] Remote (SSH) workspaces, core (23 Nov 2026): `workspaces.list/add/remove/check/restartRelay/hosts` in the app API and SDK, the relay installed on the host over ssh, per-workspace links, live workspace state, tests against a real private `sshd` (`docs/decisions/2026-11-22-remote-workspaces.md`). A busy relay of an older version stays attached and shows "needs relay update" instead of being replaced.
- [ ] SSH workspaces UI: workspace picker, add-SSH-workspace dialog, restart relay. In progress.
- [ ] Verify SSH workspaces on a real remote Linux host and on arm64 (only a local `sshd` was tried).
- [ ] Three ssh lines are not covered by any end-to-end test: `ssh-hosts.ts:37` and `ssh-check.ts:28-29`.
- [ ] `api/routing.ts` coverage: cover the remaining paths (removed and unavailable workspaces).
- [ ] Disk growth: retention and archiving for JSONL event logs, cleanup of old branches left by archived sessions.
- [ ] Relay start-up on servers without user services after logout: fallback to `nohup` or tmux.
- [ ] Decide whether Mac machines are supported as remote workspaces.
- [ ] Workspace reboot: agent processes die and not every adapter supports `session/load`. Decide what the user sees and whether sessions can be resumed.
- [x] Relay version skew (23 Nov 2026): one `VERSION` constant (from `packages/protocol/package.json`), compared on `relay/hello`; an idle old relay is replaced, a busy one stays and the workspace reads "needs relay update" until the user restarts it.
- [ ] Containers or cloud sandboxes as workspaces: after SSH, or never? It decides whether the `WorkspaceTarget` seam stays at two kinds (local, ssh).
- [ ] The relay daemon keeps the environment of whichever app first started it, so agent environment variables are frozen until it restarts. Build the agent environment explicitly (phase 5, with the gateway).
- [ ] Non-JSON-RPC output from an agent is dropped without a trace in `sessions/start.ts`. Log it.

## Abstractions (from `docs/abstractions-review.md`)
Landed (23 Nov 2026), before more code sat on top:
- [x] Normalised agent updates: the relay attaches agent-neutral `updates` to each `acp` event and a `tool` summary to permission requests; raw ACP stays in the log; the UI, usage and e2e helpers read only the normalised form. Test that an unknown update kind still renders.
- [x] A `Workdir` in the relay with two kinds, `worktree` and `directory`, so the Modify agent can run as a relay session in `ui-staging/`.
- [x] Live session summaries kept by the relay and pushed to the app, with pending permission requests (and `turnOpen`); stop re-reading every log on list, file and diff requests.
- [x] A workspace id on every live SSE message; session store key becomes `(workspace_id, id)`.
- [x] `ClientOptions.fetch` in the SDK, and the UI reading all data through one injected `Client`. (Nothing replays a recorded session through it yet.)

Later:
- [x] Phase 5 (23 Nov 2026): `WorkspaceTarget` (bridge command, install, port forward), version check on `relay/hello`, `links(workspaceId)` routing with one sync per workspace, the suite run over SSH to a local `sshd`.
- [ ] Phase 5, still open: event format version (`v: 1`) and an explicit agent environment.
- [x] Migrations are embedded for the compiled build (`store/migrations.generated.ts`; a test fails when it is behind `drizzle/`).
- [ ] Phase 6: one agent registry (`label`, `command`, `instructionsFile`, `translator`) as a `Record<AgentKind, ...>`; `hello` returns agent labels; config item schemas in `protocol`; MCP servers passed in `session/new`. The test agent should leave the product enum.
- [ ] Phase 7: `UsageRow.source` becomes an enum, usage readers become a list (`acp`, agent logs, gateway), prices in one app module; analytics read normalised updates, never raw ACP. Move `summarize` into `protocol` if imports need status app-side.
- [ ] The Modify agent: remove the unused `RunCommand` hook in `ui-workspace/checks.ts` or use it from a test.
- [ ] Runtime code exported as the app's package API only to satisfy knip (`app/src/index.ts`): the UI is wired now, so clean it up.
- Never build: a transport or plugin framework, a DI container or injected id/clock generators, other backends for the event log or store without a requirement, an interface for other git hosts before a second host, an adapter that makes sandbox-agent look like our relay, dropping raw ACP from the log, a git abstraction for jj.

## Testing
- [x] Coverage gate (22 Nov 2026): at least 95% of lines covered by the end-to-end suite, total and on changed lines, deterministic, in `check`, before every push and in CI; about 98% today. The relay and the app start inside the test process; a few tests keep real processes.
- [x] Count the UI in the coverage gate (23 Nov 2026): Chromium V8 coverage mapped through Vite source maps to source lines. Thresholds: 98% of all lines and 95% of changed lines; total about 98.9%. Only `packages/ui-template/src/index.ts` (re-exports) and thin CLI entry files are excluded, with written reasons in `coverage.config.json`.
- [ ] Make the test suite less sensitive to load: it timed out when many agents ran on a 4-core machine, and again on 23 Nov when several suites ran at once. Timing budget per test and a flake run (below); fewer parallel agents meanwhile.
- [ ] The dependency-guard test should clear the override environment variable, so it does not depend on the shell it runs in.
- [x] Keep the mock ACP agent faithful, Claude Code part (23 Nov 2026): `bun run smoke:real` drives the real adapter through the relay, app and SDK and `--record` saves the relay's logs; four scrubbed recordings are in `e2e/fixtures/recordings/claude-code/` and `e2e/updates/real-claude-code-recordings.e2e.ts` serves them and fails on any `other` update that is not left alone on purpose. The mock now mimics the adapter's modes and a cancelled turn's usage. Still open: Codex recordings (no working key), a thinking block and a plan from the real adapter (neither appeared with Haiku), and a check that every update kind the mock emits appears in a recording.
- [ ] Resume agents after a relay restart: a new adapter process can `session/load` the old session id and the next turn remembers the work (checked with the real adapter, see `docs/acp-notes.md`). Today the session reads as idle and a new prompt says its agent is not running.
- [ ] Interpret more adapter messages if the UI wants them: `session_info_update` (the agent's title for the session) and `config_option_update`.
- [ ] Cost display: a turn costing under one cent shows "$0.00" in the usage chip and the status bar; show more precision below one cent (`packages/ui-template/src/status/`).
- [x] Scripted Modify agent for end-to-end tests (`e2e/modify/`: change flow, fence, checks, update, recovery).
- [ ] Split e2e folders by layer (`relay/`, `api/`, `browser/`) with `bun run test relay|api|browser`; a timing budget per test (relay 2 s, API 4 s, browser 12 s); `bun run test --affected`.
- [ ] Nightly job: flake run (`--rerun-each 20`). A real-adapter smoke job exists (`.github/workflows/real-agents.yml`, runs `bun run smoke:real`, skipped without keys); it does not yet re-record or open an issue on failure, and Codex is not in it. Quarantine folder for flaky tests with a 7-day limit.
- [x] Browser tests of the default UI with Playwright: `playwright` 1.63.0 is a pinned dev dependency (in `e2e/package.json`), 77 browser tests in 29 files (23 Nov 2026, counted from the `test(` lines).
- [ ] Behaviour coverage map: inventory of relay methods, event kinds, API routes, SDK functions and UI components, against what the tests actually ran; gaps may only shrink.
- [ ] Golden files for durable state: real event logs (one cut off mid-line), a protocol snapshot with `PROTOCOL_VERSION` that must change on a breaking edit, an old `state.db` per migration, an old hidden UI repository per release, an SDK declaration snapshot.

## Development loop and CI
- [x] Get CI green on `main` (23 Nov 2026). `ci` is green; read `docs/decisions/2026-11-23-ci.md` for what each job proves.
- [x] The Mac job of the `build` workflow is green on `main` (23 Nov 2026): it builds both Mac apps, ad-hoc signs nested native code, smoke-tests the compiled app from the bundle and from the mounted dmg, and uploads the unsigned dmgs (`agentcontrol-mac`, about 700 MB zipped, 14 days). The red was `VERSION` reading the root `package.json`, absent in a release folder; it now reads `packages/protocol/package.json` and the build refuses to run when the two versions differ.
- [ ] Put the compiled-app smoke (`bun run build:linux` and the app smoke) into `bun run integrate`. A change that passed every gate broke the compiled app because it was not in the pre-landing path; the orchestrator runs it by hand for now.
- [ ] Someone reads the CI result after every landing: it was red for a day while local checks were green. Consider having `integrate` print the latest run state of `main`.
- [ ] Owner: set a GitHub ruleset on `main` (linear history, no force push or deletion, require the `check` status, no required pull request, owner may bypass). Test once that the integrate script's direct push is accepted.
- [ ] Add `--autostart` to the CI smoke step of the compiled relay in `.github/workflows/build.yml`; the daemon fix has landed.
- [x] `docs/releasing.md` no longer lists the compiled-relay daemon as a known issue.
- [ ] Agent guard hook in `.claude/settings.json` (block `git add -A`, repo-wide format, `bun add`, push to `main`, `--no-verify`).
- [ ] Contract snapshot script (`packages/protocol/contract.json`) and `PROTOCOL_VERSION` exchanged in `relay/hello`.
- [ ] Generate the `DATA` block of `docs/status.html` from the repository (status, test counts, coverage, last commit, CI badge); it has already drifted (it lists folders that do not exist, says 24 gate proofs where there are 25, and still shows the workdir seam and the single UI client as in progress).
- [ ] Remove an override (`esbuild`, `minimatch`, `dompurify`) when the packages that need it have moved past the affected versions; the original reason for the overrides was not written down. Revisit the TypeScript 6.0.x pin when typescript-eslint supports 7.
- [ ] Dependabot: bot updates are applied by hand by the orchestrator (decision `0001`). Revisit if that becomes a chore; security alerts work either way.
- [x] SDK imports the app's route types (`AppType`) for Hono's typed client: the dependency-cruiser rule `sdk-app-types-only` allows type-only imports.
- [ ] Decision: with integrate and CI as the hard line, are git hooks for agents still needed beyond formatting and the dependency guard?

## Release and packaging
- [ ] Mac verification. Done on a Mac runner (23 Nov 2026, Apple Silicon): the Swift menu bar app and the compiled app build for both chip types, the bundle is ad-hoc signed, and the compiled app passes the smoke test from the bundle and from the mounted dmg. Still open: a person opening the dmg on a real Mac (Gatekeeper), the menu bar app actually launched and reading the token, the Intel app running (it is built, not run), the `.node` files in `resources/ui-template/node_modules` (rolldown, lightningcss, tailwind oxide) loading and being signed with the bundle under the hardened runtime, the entitlements the Bun binaries need, and Gatekeeper's view of 300 MB of JavaScript in `Contents/Resources`. Then a person runs the app on a Mac once.
- [ ] PARKED by the owner (23 Nov 2026): Apple Developer ID (99 USD a year), signing and notarisation. The first release ships UNSIGNED (ad-hoc signed only, which Apple Silicon needs to run a binary at all). Consequences to handle now: macOS blocks the app on first open, so the README and the release notes must explain how to open it (System Settings > Privacy & Security > Open Anyway, or `xattr -dr com.apple.quarantine /Applications/AgentControl.app`); no Homebrew cask in the official tap style (a cask for an unsigned app needs the same manual step); no in-app updates. To un-park: get the Developer ID, add the repository secrets listed in `docs/releasing.md`, and the release workflow signs and notarises by itself.
- [ ] App icon (the menu bar uses a system symbol and the app has no icon file).
- [ ] Automate the Homebrew tap update (`zohrus/homebrew-agentcontrol`); it is manual today.
- [ ] In-app updates (Sparkle): deferred. The menu item opens GitHub Releases.
- [x] `actions/upload-artifact` in `build.yml` is pinned to a commit SHA.
- [ ] Release size is about 700 MB per platform (default UI `node_modules` 285 MB: monaco-editor 105 MB, lucide-react 50 MB; two Linux relays 210 MB). Trim only after measuring; decide whether it is acceptable.
- [x] Adapter environment (23 Nov 2026): adapters are installed once into `<relay dir>/adapters/<name>@<version>/` and started through `adapters/runtime` + `launch.js`, which remove `BUN_BE_BUN` before the adapter runs; the agent's environment drops `BUN_BE_BUN`, `BUN_INSTALL_CACHE_DIR` and every `AGENTCONTROL_*` except the session's port block (`docs/decisions/2026-11-23-adapter-launch.md`). Still open: a real Codex turn under the compiled relay (only `initialize` was checked), and the Mac builds (never run).
- [ ] `packages/ui-template/tsconfig.json` repeats the options of `tsconfig.base.json` because a release has no repository root: add a check that compares the two.
- [ ] The template's transitive dependencies are resolved at build time, not from `bun.lock`; revisit if a release needs byte-for-byte reproduction.
- [ ] README says `bun dev` does not open the browser. It does (on a terminal, the first time the app listens; `AGENTCONTROL_NO_OPEN` turns it off): correct the README. Also check whether Modify changes show up under `bun dev`, which serves `packages/ui-template`, not the data folder's `ui/`.

## Spike
- [ ] Verify Codex end to end (streaming granularity, thinking, diffs, permission requests). Needs an OpenAI key with quota and network access to `api.openai.com`, or the owner's Mac.
- [ ] Codex recordings for the mock-fidelity test, once Codex works.
- [ ] Confirm thinking output for Claude (`agent_thought_chunk` did not appear in two small prompts, even at high effort).

## Viewing files
- [x] Browser support (built; see `docs/decisions/2026-11-22-preview-sandbox.md`): render an HTML file from a session's worktree inside the app, in a Preview tab next to Changes and Editor, the way an HTML artifact is shown beside a chat. It must be sandboxed (an iframe with the `sandbox` attribute, served by the app from a separate path with a strict Content-Security-Policy, so the page cannot reach the AgentControl API or other sessions), refresh when the agent edits the file (the existing `relay/fs.changed` notifications), and work for a page with its own CSS, JS and images in the same folder.
- [x] Markdown preview (built with `marked` 18.1.3; see `docs/decisions/2026-11-22-markdown-preview.md`) in the same Preview tab, only if an open-source, actively maintained library passes the dependency bar in `AGENTS.md` (known owner, release in the last 12 months, permissive license, few dependencies). Candidates to evaluate when the task starts: `marked`, `markdown-it`, `micromark`. Output must be sanitised (DOMPurify is already in the tree through Monaco) and rendered in the same sandbox. If no library passes, drop the task and show Markdown files as text in the editor.

- [ ] Revisit `marked` when 18.2.x is 14 days old (bump with `ALLOW_DEP_CHANGE=1`).
- [ ] Preview follow-ups: keep the page's scroll position across a refresh (not possible from the app with an opaque origin; would need the page to cooperate), `fetch` of files in the page's own folder (blocked by `connect-src 'none'`), range requests for large video, and refreshing a page when a file outside its own folder (`../css/x.css`) changes.

## Harness config (phase 6)
- [ ] The Config screen in the UI (MCP, skills, hooks, instructions, permissions editors, import, plan, apply, rollback, drift). The backend is done and has 38 tests; the screen is in progress now (23 Nov 2026).
- [ ] Real secrets storage (OS keychain): a `${secret:NAME}` placeholder is written as is and listed as needing a secret.
- [ ] Subagents (`.claude/agents/*.md`): the canonical model has no subagent item.
- [ ] Codex items with no native format written yet: allow and deny lists (Codex has a different rules format) and commands (Codex 0.171 does not load them; could become skills).
- [ ] Verify the assumed hook matchers (`Edit|Write|MultiEdit` for Claude, `apply_patch` for Codex) with a real model call.
- [ ] Config editor limits (`packages/relay/src/config/FORMATS.md`): the TOML editor has no parser (quoted or dotted server names, a server hand-written with an `env` sub-table, header-looking lines in multi-line strings); a hook group with several commands imports as several items; removing the hand-written-notes item leaves the text in the file; plans are kept in memory (latest 20); JSON files are rewritten with 2-space indentation.
- [ ] MCP servers passed in `session/new` for per-session use.

## Console
- [x] Console access from inside the app (done 23 Nov 2026, `docs/decisions/2026-11-23-console.md`) (phase 5, remote workspaces; also works locally; in progress, 23 Nov 2026, with `@xterm/xterm` and `@xterm/addon-fit` approved and a WebSocket endpoint guarded by the same Host, Origin and token rules): a Terminal tab that opens a shell in the session's worktree on its workspace. Browser side: `@xterm/xterm` (xterm.js, MIT, zero dependencies, the VS Code terminal). Workspace side: the relay starts the shell in a pseudo-terminal with Bun's built-in terminal support (no `node-pty`); verify it works in the compiled Linux relay binary. Input, output and resize go over the existing relay connection as `relay/terminal.*` methods, so no extra port or second SSH login. The ACP `terminal` capability stays off for agents.

## Modify agent
- [ ] Codex as the Modify agent: it gets no launch limits, only the relay's permission answers as the fence. Try it for real.
- [ ] Checks beyond typecheck and build: lint and a browser load test of the new UI (the plan lists them).
- [ ] Use the Modify panel by hand for a day (browser tests and one real run so far).

## App robustness
- [ ] Long sessions: list virtualization and batching of streamed chunks so the browser doesn't stall.
- [ ] App upgrades: database migrations, a backup of `state.db` before each update, compatibility of old JSONL logs.
- [ ] Diagnostics: app and relay logs, a "copy diagnostics" button for bug reports.
- [ ] Write down the telemetry policy (proposed: none).

## Analytics
- [x] The Analytics screen (phase 7): durable `usage` table, summary, sessions and insights API, `analytics.*` in the SDK, rule-based insights, plain SVG charts (no chart library), session table, filters, light and dark. Screenshots: `docs/ui-analytics-light.png`, `docs/ui-analytics-dark.png`.
- [x] Sub-cent costs show as "<$0.01" in the chip and status bar, and with four decimals in Analytics.
- [x] Sessions with tokens and no reported cost are marked "no cost reported", never counted as $0.
- [ ] Subscription users (Claude Pro/Max, ChatGPT) have no dollar cost: show usage against plan limits instead (needs the plan's limits from the agent; the Analytics screen only says "no cost reported" for now).
- [ ] Analytics reads every event of every session on each request, and the app reads all usage from the relay on each connection. Cache per session (by last seq) and read usage incrementally if it gets slow.
- [ ] Analytics: the Modify agent's sessions are not counted; a chart library is not needed so far (the three charts are about 250 lines of SVG).

## Decisions made
- [x] Local server lock-down (22 Nov 2026): Host and Origin checks and a secret token sent as a header, never a cookie (cookies are not isolated by port). `docs/decisions/2026-11-22-local-server-security.md`.
- [x] Preview sandbox and Markdown library (22 Nov 2026): sandboxed iframe, ticketed route, `marked` 18.1.3 with DOMPurify. `docs/decisions/2026-11-22-preview-sandbox.md`, `2026-11-22-markdown-preview.md`.
- [x] Harness config ownership: the app owns only the entries it created, tracked in a manifest. `docs/decisions/0001-harness-config-ownership.md`.
- [x] Duplication limit zero; gate proofs (25) run in CI. `docs/decisions/2026-11-22-duplication-threshold-zero.md`.
- [x] Live session summaries and workspace identity. `docs/decisions/2026-11-22-live-session-summaries.md`.
- [x] Modify agent runs as a directory session; the relay answers its permission requests. `docs/decisions/modify-directory-sessions.md`.
- [x] Real Claude Code runs in Manual mode or the session does not start (23 Nov 2026). `docs/decisions/2026-11-23-claude-code-manual-mode.md`.
- [x] Release layout (23 Nov 2026): one folder per platform, the app is its own `bun`, migrations embedded. `docs/decisions/2026-11-23-release-layout.md`.
- [x] CI jobs and how to read a red run (23 Nov 2026). `docs/decisions/2026-11-23-ci.md`.
- [x] First Mac release is unsigned; Apple Developer ID parked (owner, 23 Nov 2026). See "Release and packaging".
- [x] Coverage exclusions approved by the owner (22 Nov 2026): the seven thin start-up files proven by the real-process tests, the UI package until browser tests report coverage, the Swift Mac app, and one tooling config file. The list is in `coverage.config.json`; it may only shrink.
- [x] Laptop platform: macOS only.
- [x] License: MIT. Add the `LICENSE` file when the repo is created.
- [x] Merge style: no pull requests. Claude pushes straight to `main` and keeps `docs/status.html` up to date.
- [x] How work lands: an orchestrator (Claude) splits work into briefs for parallel coding subagents (Sonnet) and research subagents (Opus), each in its own git worktree. Checked work is pushed straight to `main` through the integrate script. `main` must stay green; when it is not, revert first.
- [x] Testing: end-to-end only, GIVEN / WHEN / THEN banner comments, plus at least 95% of lines covered by the end-to-end suite, total and on changed lines, deterministic, required before any push. Tests run the relay and app in the test process so coverage can see them, with a few tests against the real separate processes.
- [x] Code review: every agent runs the `/code-review` skill on its own diff and fixes what it finds before pushing or handing work back.
- [x] Agent events (amends the earlier decision that events carry the raw ACP message for the UI): the raw ACP message stays stored unchanged in the relay's log, and the relay attaches normalised, agent-neutral updates that the UI, usage and analytics read. Agents that do not speak ACP are not in scope.
- [x] Dependency freshness: newest versions allowed by a 14-day minimum release age (Bun's `minimumReleaseAge`, verified working). TypeScript is pinned to 6.0.x because typescript-eslint does not support 7 yet. Exact pins. Overrides for `esbuild`, `minimatch` and `dompurify` clear audit advisories.
- [x] Relay process model: the relay is a daemon on a unix socket (owner-only permissions) that keeps running when the app closes. `relay --stdio` is a thin bridge that starts it when needed; SSH runs the same bridge command in phase 5.
- [x] Own relay, not Rivet's sandbox-agent: built.
- [x] Menu bar shell: a small Swift app (`packages/mac`).
- [x] Model picker: config options (category `model`); the SDK has no `session/set_model`.

## To verify in Step 1
- [x] typescript-eslint does not support TypeScript 7 yet: TypeScript is pinned to 6.0.x (decision `docs/decisions/0001-dev-loop.md`). Revisit when typescript-eslint announces support.
- [x] Bun's `minimumReleaseAge` install setting exists and works (set to 14 days in `bunfig.toml`).
- [ ] Decide whether to shorten the 14-day release age so security fixes arrive sooner.

## Normalised updates
- [ ] The app stores the normalised updates it receives, so sessions synced before a normaliser improvement keep the old form. Add a normaliser version and re-sync, or strip on save and normalise on read.

