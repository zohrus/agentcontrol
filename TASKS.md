# AgentControl: tasks for later

Items we found while reviewing the plan (22 Nov 2026) and chose not to put in it yet.
Each one should become a plan change, a roadmap task, or a decision when its time comes.
The plan (`docs/plan.html`) holds the roadmap and the open questions; this file holds the long tail.
Detailed progress per component is on the live status page: https://claude.ai/artifact/A88MyfyQ1j1KEUSjRidmRU (also `docs/status.html`).

## Before the repository exists
- [x] Create the GitHub repo (`zohrus/agentcontrol`), then commit the plan as `docs/plan.html`.
- [x] Update the handoff `CLAUDE.md`: working name (AgentControl), macOS only, MIT, MVP roadmap, git-based UI updates, quality rules and dependency list. Then turn it into `AGENTS.md` plus a one-line `CLAUDE.md` that imports it.
- [ ] Final name. "AgentControl" / `agentcontrol` is a working name only ("Agent Control" is taken). Ideas so far: AgentZ, Hill Sphere / Hill, Minimoon, Saturn, Constellation, AgentOrbit.
- [ ] Before the first public release: rename everywhere (`@agentcontrol/sdk`, `~/.agentcontrol/`, `AGENTCONTROL_PORT_BASE`, `AgentControl.dmg`, cask), then claim the npm scope, Homebrew cask name and a domain.

## Security (deferred)
- [ ] Lock down the local server. Done: it listens on `127.0.0.1` only. Still to do: require a random token generated at startup, check `Origin` and `Host` headers (blocks attacks from websites open in the browser, including DNS rebinding).
- [x] Relay socket: readable only by the owner (`0600`), so other users on the machine can't drive your agents. (Set in `packages/relay/src/daemon/server.ts`; still check the folder permissions on shared SSH workspaces in phase 5.)

## Sessions and git
- [ ] How work leaves a worktree: commit, push the branch, open a PR, then archive. Open question: `gh` on the workspace with its own login, or the GitHub API from the app with a token in the keychain. Proposed shape: one relay feature (`publish/`) with `relay/git.commit`, `relay/git.push`, `relay/pr.create`; no interface for other git hosts.
- [ ] Sessions started outside the app (`claude` run in a terminal): show them (e.g. via hooks, as Emdash does) or ignore them.
- [ ] External trajectories (sessions recorded elsewhere): read-only viewing, or resumable? Imported by the app (cloud trace systems) or by the relay (agent logs in `~/.claude/projects`, `~/.codex/sessions`)? Decide before building; read-only sources would become extra workspaces in the app.
- [ ] Previewing an agent's dev server: forward its port over SSH and open it from the session.
- [ ] Prompt input: images, `@file` references, slash commands. Both adapters advertise `image` and `embeddedContext` prompts; check slash commands (`available_commands_update`).
- [ ] The relay accepts a `model` on `relay/sessions.create` and drops it. Pass it through when the model picker is wired (use the config option of category `model`).
- [ ] Codex retries network errors for a long time without failing. Give turns their own timeout in the relay.
- [ ] Use `session/resume` (no replay) instead of `session/load` when resuming an agent; never append replayed messages to the event log.

## Workspaces and the relay
- [ ] Disk growth: retention and archiving for JSONL event logs, cleanup of old branches left by archived sessions.
- [ ] Relay start-up on servers without user services after logout: fallback to `nohup` or tmux.
- [ ] Decide whether Mac machines are supported as remote workspaces.
- [ ] Workspace reboot: agent processes die and not every adapter supports `session/load`. Decide what the user sees and whether sessions can be resumed.
- [ ] Relay version skew: running sessions keep the old relay after an update. Does the app then talk to two relay versions on one workspace? Check `relay/hello` versions instead of ignoring the result (the version strings are the literal `"0.0.0"` in three places).
- [ ] Containers or cloud sandboxes as workspaces: after SSH, or never? It decides whether the `WorkspaceTarget` seam stays at two kinds (local, ssh).
- [ ] The relay daemon keeps the environment of whichever app first started it, so agent environment variables are frozen until it restarts. Build the agent environment explicitly (phase 5, with the gateway).
- [ ] Non-JSON-RPC output from an agent is dropped without a trace in `sessions/start.ts`. Log it.

## Abstractions (from `docs/abstractions-review.md`)
In progress now (before more code sits on top):
- [ ] Normalised agent updates: the relay attaches agent-neutral `updates` to each `acp` event and a `tool` summary to permission requests; raw ACP stays in the log; the UI, usage and e2e helpers read only the normalised form. Test that an unknown update kind still renders.
- [ ] A `Workdir` in the relay with two kinds, `worktree` and `directory`, so the Modify agent can run as a relay session in `ui-staging/`.
- [ ] Live session summaries kept by the relay and pushed to the app, with pending permission requests (and `turnOpen`); stop re-reading every log on list, file and diff requests.
- [ ] A workspace id on every live SSE message; session store key becomes `(workspace_id, id)`.
- [ ] `ClientOptions.fetch` in the SDK, and the UI reading all data through one injected `Client`.

Later:
- [ ] Phase 5: `WorkspaceTarget` (bridge command, install, port forward), version check on `relay/hello`, event format version (`v: 1`), explicit agent environment, `links(workspaceId)` routing with one sync per workspace, the suite run over SSH to a local `sshd`, a test with two local relays.
- [ ] Migrations are found through `import.meta.dir`, which breaks in the compiled app. Embed them for the compiled build.
- [ ] Phase 6: one agent registry (`label`, `command`, `instructionsFile`, `translator`) as a `Record<AgentKind, ...>`; `hello` returns agent labels; config item schemas in `protocol`; MCP servers passed in `session/new`. The test agent should leave the product enum.
- [ ] Phase 7: `UsageRow.source` becomes an enum, usage readers become a list (`acp`, agent logs, gateway), prices in one app module; analytics read normalised updates, never raw ACP. Move `summarize` into `protocol` if imports need status app-side.
- [ ] The Modify agent: remove the unused `RunCommand` hook in `ui-workspace/checks.ts` or use it from a test.
- [ ] Runtime code exported as the app's package API only to satisfy knip (`app/src/index.ts`): clean up once the UI is wired.
- Never build: a transport or plugin framework, a DI container or injected id/clock generators, other backends for the event log or store without a requirement, an interface for other git hosts before a second host, an adapter that makes sandbox-agent look like our relay, dropping raw ACP from the log, a git abstraction for jj.

## Testing
- [ ] Coverage gate: at least 95% of lines covered by the end-to-end suite, total and on changed lines, deterministic, required before any push. Build `startRelayInProcess()` and `startAppInProcess()` (taking data folder, environment and clock as parameters, returning `stop()`), keep a small `e2e/process/` folder of real-process tests (relay restart, app close and reopen, bridge framing, agent crash, compiled binary), then add `test:coverage` and a ratchet that never lets coverage go down. Bun only measures the test process and has no per-file thresholds.
- [ ] Keep the mock ACP agent faithful: record real Claude Code and Codex sessions (`spike/` driver writes the tap to `e2e/fixtures/recordings/`) and add a contract test that every update kind and permission shape the mock emits appears in a recording.
- [ ] Scripted Modify agent for end-to-end tests, making predictable UI edits (Keep then Undo restores the file; an edit outside `ui-staging/` is refused).
- [ ] Split e2e folders by layer (`relay/`, `api/`, `browser/`) with `bun run test relay|api|browser`; a timing budget per test (relay 2 s, API 4 s, browser 12 s); `bun run test --affected`.
- [ ] Nightly job: flake run (`--rerun-each 20`), and a real-adapter smoke job (`e2e/real/`, API-key secrets, re-records, opens an issue on failure). Quarantine folder for flaky tests with a 7-day limit.
- [ ] Browser tests of the default UI with Playwright. Decide whether `@playwright/test` becomes a pinned dev dependency or the preinstalled Playwright is used.
- [ ] Behaviour coverage map: inventory of relay methods, event kinds, API routes, SDK functions and UI components, against what the tests actually ran; gaps may only shrink.
- [ ] Golden files for durable state: real event logs (one cut off mid-line), a protocol snapshot with `PROTOCOL_VERSION` that must change on a breaking edit, an old `state.db` per migration, an old hidden UI repository per release, an SDK declaration snapshot.

## Development loop and CI
- [ ] Get CI green on `main`. It is set up (`ci`, `audit`, `build`, `release`) but the first runs failed; prove the fixes with a run on a clean machine.
- [ ] Owner: set a GitHub ruleset on `main` (linear history, no force push or deletion, require the `check` status, no required pull request, owner may bypass). Test once that the integrate script's direct push is accepted.
- [ ] Add `--autostart` to the CI smoke step of the compiled relay in `.github/workflows/build.yml`; the daemon fix has landed.
- [ ] `docs/releasing.md` still lists the compiled-relay daemon as a known issue; it is fixed. Update the page.
- [ ] Agent guard hook in `.claude/settings.json` (block `git add -A`, repo-wide format, `bun add`, push to `main`, `--no-verify`).
- [ ] Contract snapshot script (`packages/protocol/contract.json`) and `PROTOCOL_VERSION` exchanged in `relay/hello`.
- [ ] Generate the `DATA` block of `docs/status.html` from the repository (status, test counts, coverage, last commit, CI badge); it has already drifted (for example it marks CI done and lists folders that do not exist).
- [ ] Dependabot: bot updates are applied by hand by the orchestrator (decision `0001`). Revisit if that becomes a chore; security alerts work either way.
- [ ] SDK imports the app's route types (`AppType`) for Hono's typed client; the dependency-cruiser rule `sdk-no-relay` forbids it. Allow type-only imports of the app's root `index.ts` from `sdk`, or restate every route as zod in `protocol`.
- [ ] Decision: with integrate and CI as the hard line, are git hooks for agents still needed beyond formatting and the dependency guard?

## Release and packaging
- [ ] First run of the `build` workflow on a macOS runner: the Swift menu bar app, `make-app.sh`, `sign-and-notarize.sh` (codesign, notarytool, stapler, hdiutil), the entitlements the Bun binaries need under the hardened runtime, and the cross-architecture `swift build` have never run. Expect small fixes. Execute the darwin binaries once.
- [ ] Owner: Apple Developer ID (99 USD a year) and the repository secrets listed in `docs/releasing.md` (`APPLE_CERT_P12_BASE64`, `APPLE_CERT_PASSWORD`, `APPLE_SIGNING_IDENTITY`, plus one notarisation set).
- [ ] App icon (the menu bar uses a system symbol and the app has no icon file).
- [ ] Automate the Homebrew tap update (`zohrus/homebrew-agentcontrol`); it is manual today.
- [ ] In-app updates (Sparkle): deferred. The menu item opens GitHub Releases.
- [ ] Pin `actions/upload-artifact` in `build.yml` to a commit SHA like the other actions.

## Spike
- [ ] Verify Codex end to end (streaming granularity, thinking, diffs, permission requests). Needs an OpenAI key with quota and network access to `api.openai.com`, or the owner's Mac.
- [ ] Confirm thinking output for Claude (`agent_thought_chunk` did not appear in two small prompts, even at high effort).

## Viewing files
- [ ] Browser support: render an HTML file from a session's worktree inside the app, in a Preview tab next to Changes and Editor, the way an HTML artifact is shown beside a chat. It must be sandboxed (an iframe with the `sandbox` attribute, served by the app from a separate path with a strict Content-Security-Policy, so the page cannot reach the AgentControl API or other sessions), refresh when the agent edits the file (the existing `relay/fs.changed` notifications), and work for a page with its own CSS, JS and images in the same folder.
- [ ] Markdown preview in the same Preview tab, only if an open-source, actively maintained library passes the dependency bar in `AGENTS.md` (known owner, release in the last 12 months, permissive license, few dependencies). Candidates to evaluate when the task starts: `marked`, `markdown-it`, `micromark`. Output must be sanitised (DOMPurify is already in the tree through Monaco) and rendered in the same sandbox. If no library passes, drop the task and show Markdown files as text in the editor.

## Console
- [ ] Console access from inside the app (phase 5, remote workspaces; also works locally): a Terminal tab that opens a shell in the session's worktree on its workspace. Browser side: `@xterm/xterm` (xterm.js, MIT, zero dependencies, the VS Code terminal). Workspace side: the relay starts the shell in a pseudo-terminal with Bun's built-in terminal support (no `node-pty`); verify it works in the compiled Linux relay binary. Input, output and resize go over the existing relay connection as `relay/terminal.*` methods, so no extra port or second SSH login. The ACP `terminal` capability stays off for agents.

## App robustness
- [ ] Long sessions: list virtualization and batching of streamed chunks so the browser doesn't stall.
- [ ] App upgrades: database migrations, a backup of `state.db` before each update, compatibility of old JSONL logs.
- [ ] Diagnostics: app and relay logs, a "copy diagnostics" button for bug reports.
- [ ] Write down the telemetry policy (proposed: none).

## Analytics
- [ ] Subscription users (Claude Pro/Max, ChatGPT) have no dollar cost: show usage against plan limits instead.

## Decisions made
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
