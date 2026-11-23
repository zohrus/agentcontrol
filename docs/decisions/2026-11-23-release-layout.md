# 2026-11-23 Release layout: the compiled app runs without a source tree and without `bun`

Date: 2026-11-23   Author: release-layout agent

## Context

`bun run build` compiled the relay and the app, but nobody had run the compiled app. It could not
work: migrations were read from a folder next to the source, the UI was Vite on the source tree,
the Modify checks resolved `tsc` from the repository, and adapters were started with `bunx`, which
a user's Mac does not have.

## Decision

- **One folder per platform**, `dist/release/<os>-<arch>/` (linux-x64, darwin-arm64, darwin-x64).
  For macOS it is copied as `AgentControl.app/Contents/Resources/`:

  ```
  agentcontrol                the app binary
  agentcontrol-relay          the relay of this platform
  relays/agentcontrol-relay-linux-{x64,arm64}   what remote workspaces are installed from
  resources/ui-template/      default UI: sources and node_modules
  ```

- **One function finds it** (`packages/app/src/resources/`): `AGENTCONTROL_RESOURCES` (the
  `resources` folder), then `resources/` next to the binary, then `../Resources/resources` for a
  Mac bundle, then the source checkout's `packages/ui-template`. It also finds the relay next to
  the app and the `relays/` folder. A release (not the source checkout) serves `<dataDir>/ui`,
  which is seeded from the shipped template on first run; `bun dev` still passes `--ui-root`.
- **The binary is its own `bun`.** A compiled Bun binary started with `BUN_BE_BUN=1` behaves as
  the `bun` command (checked on Bun 1.4.4: `x`, scripts, `node_modules/.bin` tools). The app runs
  Vite (a child process, `ui-template/server.ts`, the same in source and compiled), `vite build`
  and `tsc` through `process.execPath`; the relay runs adapters as `<relay> x --bun pkg@version`.
  The variable is set only on those child processes, never on the app or relay themselves.
- **Migrations are embedded**: `scripts/embed-migrations.ts` (run by `db:generate`) writes
  `store/migrations.generated.ts`; the same code path runs from source and compiled. An e2e test
  fails when the file is behind the `drizzle/` folder.
- **node_modules is a real, flat install made for the target platform** (`bun install --linker
  hoisted --os --cpu`), so a Linux machine can build the Mac folders. The SDK and protocol are
  copied in as sources; the app only as `.d.ts` (the SDK's types are made of the app's types), so
  `tsc` on the user's UI does not typecheck the whole app. `tsconfig.json` of the template is
  self-contained (it no longer extends the repository's base).
- **Adapters** are pinned in `relay/src/agents/adapters.ts` and cached in `<relay data dir>/adapters`
  (`BUN_INSTALL_CACHE_DIR`), not the user's global cache. A first use says "Downloading the Claude
  Code adapter..." in the session's output, and a failed download says to check the internet.
- **Nothing is written into the shipped folder**: Vite's cache is `<ui>/.vite`, and the config is
  loaded with `--configLoader runner`, so an installed (and signed) app bundle is never modified.
  The links `<dataDir>/ui/node_modules` and `ui-staging/node_modules` are repointed on every start,
  so moving or updating the app keeps them working.

- **No prebuilt `dist/` is shipped.** Measured on a cold start (fresh data folder, no Vite cache,
  Linux, a loaded machine): the UI is on screen 3.3 s after the page is requested, so a static
  fallback for "instant first start" would be 15 MB and a second code path for nothing.
- **The UI server is supervised.** It is a child process; when it dies by itself (it did once,
  under memory pressure) the app starts it again, and it quits when the app that started it is gone.

## Rejected

- `bunx`/`bun` from PATH: not there on a user's Mac.
- A separate `bun` executable in the resources: 100 MB more, and the self-as-bun trick works.
- Running Vite inside the app process: a Vite crash would take the app down; the child process is
  the same code in source and compiled, so the e2e suite covers it.
- Copying the monorepo's `node_modules/.bun` store: platform of the build machine only, and 560 MB.

## Consequences

- A release folder is large (see `docs/releasing.md` for sizes); `monaco-editor` is the biggest
  part of `node_modules`. Trim only after measuring.
- `.node` binaries inside `resources/ui-template/node_modules` must be signed with the bundle
  (hardened runtime): the signing script has to sign them, which is unverified until a Mac run.
- Transitive dependencies of the shipped `node_modules` are resolved at build time, not from
  `bun.lock`; the direct ones are pinned. Revisit if a release needs byte-for-byte reproduction.
- The adapter's environment carries `BUN_BE_BUN=1` and `BUN_INSTALL_CACHE_DIR` (the relay's
  adapter folder), so shell commands an agent runs inherit them: a Bun-compiled program of the
  user's would act as `bun`, and the agent's own `bun install` would cache in the relay's folder.
  Checked: the native Claude Code binary (2.1.330) ignores `BUN_BE_BUN`. `bunx` has no flag for the
  cache folder, and a symlink named `bun` does not make a compiled binary act as bun, so the
  variables cannot be kept out of the adapter's environment. Revisit if it bites.
