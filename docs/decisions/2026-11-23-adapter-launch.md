# 2026-11-23 Adapter launch: installed once by the relay, started without internal variables

Date: 2026-11-23   Author: relay agent (adapter launch)

## Context

The relay started the ACP adapters with `<relay binary> x --bun <package>@<version>` and
`BUN_BE_BUN=1` plus `BUN_INSTALL_CACHE_DIR` in the agent's environment. Everything the adapter
started (and so every shell command an agent ran) inherited both. Verified with Bun 1.4.4:

- A program compiled with `bun build --compile` that runs with `BUN_BE_BUN=1` in its environment
  acts as the `bun` command (`BUN_BE_BUN=1 ./prog --version` prints `1.4.4`). So a user's own
  compiled Bun program, started by an agent, would not run its own code.
- A real `bun` on PATH ignores `BUN_BE_BUN`, but `BUN_INSTALL_CACHE_DIR` makes its `bun install` use
  the relay's folder as its package cache.
- The agent also inherited every `AGENTCONTROL_*` variable of the relay (adapter folder, command
  overrides, test settings), and `launch.env` was merged over the whole relay environment.

The previous attempt found that `--preload`, `BUN_OPTIONS`, `NODE_OPTIONS` and `bunfig.toml` do not
help with `bun x`, because `x` itself needs the variable to start the adapter.

## Decision

1. **The relay installs the adapter itself, once.** `<data dir>/adapters/<name>@<version>/` holds a
   `package.json` with the one pinned dependency and a hoisted `node_modules`. The install runs
   `<relay binary> install --linker hoisted` as a child with `BUN_BE_BUN=1` and a package cache
   inside the work folder (deleted afterwards). That child ends before any agent starts, so the
   variables never reach an agent. It runs in a temporary `.installing-<uuid>` folder that is renamed
   into place, so nobody sees half an install. Installs in progress are shared inside the relay
   process (two sessions starting together install once); across processes the rename decides and
   the loser uses the winner's folder. A half-made folder older than an hour (a killed relay) is
   removed at the next install. The first start needs the network; every later start only looks at
   the folder. A failed install throws one plain message: the adapter was not downloaded, check your
   internet connection and start the session again, followed by Bun's last lines.
2. **The adapter starts through a shell script, `adapters/runtime`, and `adapters/launch.js`.**
   `runtime` is `BUN_BE_BUN=1 exec <relay binary> run launch.js "$@"`; the variable exists only for
   that exec. `launch.js` deletes `BUN_BE_BUN` first thing, then imports the adapter's entry file
   (found from the package's `bin`). Both files are rewritten (atomically) when their text changes,
   for example after the app moved. The script also passes `--no-env-file` and
   `--config=<adapters>/bunfig.toml` (an empty file): Bun starts in the session's worktree and would
   otherwise run a repo's `bunfig.toml` preload and load its `.env` into the adapter (shown by a
   test with both in the repo). From source, the "relay binary" is plain `bun` and the variable
   changes nothing, so source and compiled runs take the same path.
3. **`process.execPath` is pointed at `runtime`.** Found by trying the real adapters under the
   compiled relay: `codex-acp` starts its `codex.js` with `spawn(process.execPath, [codex.js])` and
   needed the leaked `BUN_BE_BUN` to do so (without it the relay binary printed its own usage and
   Codex failed at `initialize`). With `execPath` set to `runtime`, such a child is started the same
   clean way and the variable is deleted there too.
4. **`Bun.spawn` and `Bun.spawnSync` are given `process.env` by default.** In Bun, deleting a
   variable from `process.env` does not remove it from what `Bun.spawn` passes when no `env` is
   given (checked in plain Bun and in a compiled binary); `node:child_process` is correct. The
   adapters are Node code, but the launcher closes the hole for any dependency that uses Bun's API.
5. **The agent's environment is the relay's minus its own variables**: `BUN_BE_BUN`,
   `BUN_INSTALL_CACHE_DIR` and every `AGENTCONTROL_*`, plus the session's `PORT` and
   `AGENTCONTROL_PORT_BASE` (the same rule as the terminal's). This also applies to
   `AGENTCONTROL_AGENT_<NAME>_CMD` overrides, which keep working as before.

Pinned versions are unchanged. No new dependencies. The Modify agent uses the same launch path (it
is a session of the relay), and ssh workspaces run the same relay binary, which installs on its own
machine.

## Evidence

- End-to-end tests (`e2e/sessions/adapter-launch.e2e.ts`): a command an agent runs sees only the
  session's `PORT` and `AGENTCONTROL_PORT_BASE`, started from an installed adapter, from an adapter
  that starts its agent with `process.execPath`, and from a command override; two sessions starting
  together download once; a second start works with the registry gone; a stale half-made install
  is removed; a failed install leaves nothing and says what to do.
- Compiled app smoke (`scripts/smoke/adapter-step.ts`): the compiled Linux app, with no `bun` on
  PATH, installs the adapter from a registry on the machine (its program is the mock agent) with its
  own runtime, and the agent's command sees none of the internal variables.
- Real adapters, compiled relay as the runtime, no `bun` on PATH, installed from registry.npmjs.org:
  `claude-agent-acp` 0.109.1 and `codex-acp` 2.9.0 both answer `initialize`.

## Rejected

- **A subcommand of the relay that imports the adapter** (`agentcontrol-relay run-adapter <entry>`,
  no `BUN_BE_BUN` anywhere): a compiled binary cannot resolve packages from a `node_modules` on disk
  for a file it imports (`Cannot find module '@anthropic-ai/claude-agent-sdk'`, tried with Bun 1.4.4).
- **Deleting the variable in the launcher only**: leaves it in `Bun.spawn`'s default environment and
  breaks Codex, which needs a runtime in `process.execPath`.
- **`CODEX_PATH` pointing at Codex's native binary**: skips the `codex.js` shim, which also sets
  up `PATH` for Codex's helper programs; the platform table would have to be copied.
- **Keeping `bun x` and filtering the variables in the adapter**: nothing runs early enough (see
  above).
- Keeping the package cache in the relay's folder: the install already unpacks into the adapter
  folder, so a second copy of 400 MB would stay behind. The cache is temporary.
