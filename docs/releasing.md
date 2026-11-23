# Releasing AgentControl

## Cut a release

1. Set `"version"` in the root `package.json` (for example `0.2.0`) and commit it to `main`.
2. Tag and push: `git tag v0.2.0 && git push origin v0.2.0`.
3. The `release` workflow builds everything on a macOS runner, signs and notarizes when the
   secrets below exist, and publishes a GitHub Release with `AgentControl-<version>-arm64.dmg`,
   `AgentControl-<version>-x64.dmg`, the relay binaries and `manifest.json`. It refuses a tag that
   does not match the `package.json` version.
4. Update the Homebrew tap: copy `packaging/homebrew/agentcontrol.rb.template` to
   `Casks/agentcontrol.rb` in the tap repository (`zohrus/homebrew-agentcontrol`), fill in
   `@VERSION@` and the two sha256 values (`shasum -a 256` of each .dmg, or from `manifest.json`
   for the binaries), and push. This step is manual for now.

Every push to `main` also runs the `build` workflow: it builds the same files with an unsigned
(ad-hoc) dmg and uploads them as workflow artifacts, and smoke-tests the Linux relay.

Locally: `bun run build` writes the binaries, `dist/manifest.json` and one release folder per Mac
architecture (see below). `bun run build:linux` builds the Linux x64 app and its release folder,
which is what the smoke tests run:

- `bun scripts/smoke-binary.ts dist/agentcontrol-relay-linux-x64` runs the compiled relay.
- `bun scripts/smoke-binary.ts --app dist/release/linux-x64` runs the compiled app from a clean
  copy of the folder (temp working folder, no `bun` on PATH, no source tree) and prints PASS or
  FAIL for each step: it listens, `/api/health`, the UI page and a script load, the database is
  migrated, a mock-agent session runs, a Modify request fails its typecheck, is fixed, builds and
  is promoted (the shipped `tsc` and Vite run), the UI server serves the promoted file, and nothing
  was written into the shipped `node_modules`. It takes 30 to 90 seconds.

On a Mac: `swift build -c release` in `packages/mac`, then `scripts/mac/make-app.sh arm64` and
`scripts/mac/sign-and-notarize.sh arm64` (use `x64` for Intel).

## The release folder

`bun run build` assembles `dist/release/<os>-<arch>/` for `darwin-arm64` and `darwin-x64` (and
`linux-x64` with `--linux-app`). For macOS, `make-app.sh` copies it as `Contents/Resources/`.

```
agentcontrol                                  the app (a compiled Bun binary)
agentcontrol-relay                            the relay for this platform
relays/agentcontrol-relay-linux-x64           the relays that remote workspaces are installed
relays/agentcontrol-relay-linux-arm64           from (the SSH code looks here, next to the app)
resources/ui-template/                        the default UI
  package.json index.html src/ vite.config.ts server.ts tsconfig.json
  node_modules/                               installed for this platform: vite, react, tailwind,
                                              monaco, typescript, @types/*, the SDK and protocol
                                              (sources) and the app's types (.d.ts)
```

The app finds the folder with one function (`packages/app/src/resources/`): the folder named by
`AGENTCONTROL_RESOURCES` (it holds `ui-template/`), else `resources/` next to the executable, else
`../Resources/resources` of a Mac bundle, else the source checkout. `AGENTCONTROL_RELAY_CMD` (set
by the menu bar app) still overrides where the relay is.

How it runs with no tools installed: the app binary started with `BUN_BE_BUN=1` is the `bun`
command. The app runs Vite (the UI dev server, as a child process; restarted if it dies), `vite
build` and `tsc` that way, against the shipped `node_modules`. The relay installs the agent adapters with the
same trick, once: `<data dir>/relay/adapters/<name>@<pinned version>/` is made by
`agentcontrol-relay install` on first use ("Downloading the Claude Code adapter..." appears in the
session; offline it says to check the connection), and every later start only reads that folder. The
adapter is started through `adapters/runtime` and `adapters/launch.js`, which remove `BUN_BE_BUN`
before the adapter runs, so agents and the commands they run never see it (see
`docs/decisions/2026-11-23-adapter-launch.md`). The data folder holds the live
UI (`ui/`), `ui-staging/` and `ui-template/`, with `node_modules` linked to the release folder; the
links are repointed on every start. Nothing is ever written into the release folder.

The `node_modules` is made by `bun run build`, per platform. The template's own dependencies (Vite,
Tailwind and their native binaries) are installed fresh with `bun install --linker hoisted --os
<os> --cpu <cpu>` under the repository's `bunfig.toml`, so a pin younger than 14 days fails the
build: wait, or bump to an older version. TypeScript, `@types/bun`, Hono and drizzle-orm (and what
they depend on) are copied from the repository's own install, so they are the versions `bun.lock`
chose. The transitive packages of the fresh install are resolved at build time, not from `bun.lock`.

Sizes (linux-x64, same order of magnitude for the Macs): whole folder 718 MB (app 105 MB, relay
105 MB, two Linux relays 210 MB, `resources` 300 MB); `node_modules` 285 MB, of which monaco-editor
105 MB, lucide-react 50 MB, typescript 24 MB. Under the 400 MB line, so nothing is trimmed.

Not verified without a Mac: the darwin binaries running, `make-app.sh` with the new layout, the
`.node` files inside `node_modules` (rolldown, lightningcss, tailwind oxide) being signed with the
bundle and loading under the hardened runtime, and Gatekeeper's view of 300 MB of JavaScript in
`Contents/Resources`.

## Secrets the owner must add (repository Settings, Secrets and variables, Actions)

An Apple Developer ID (99 USD a year) is needed. Without these secrets the release still runs but
the dmgs are ad-hoc signed and not notarized, and Gatekeeper will warn.

- `APPLE_CERT_P12_BASE64`: the "Developer ID Application" certificate and private key exported
  from Keychain Access as .p12, then `base64 -i cert.p12`.
- `APPLE_CERT_PASSWORD`: the password chosen when exporting the .p12.
- `APPLE_SIGNING_IDENTITY`: the certificate's name, e.g. `Developer ID Application: Your Name (TEAMID)`.

Notarization needs one of these two sets:

- `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_PASSWORD` (an app-specific password from appleid.apple.com), or
- `APPLE_API_KEY_BASE64` (the App Store Connect .p8 key, base64), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`.

## Not automated yet

- In-app updates (Sparkle) are deferred. The menu item "Check for updates..." opens the GitHub
  Releases page.
- The Homebrew tap update (step 4).
- The app icon: the menu bar uses a system symbol and the app has no icon file yet.

## What could not be verified on Linux

Everything Mac-specific was written without running it: the Swift menu bar app (compiled on a CI Mac runner, never launched by a person),
`make-app.sh`, `sign-and-notarize.sh` (codesign, notarytool, stapler, hdiutil), the entitlements
needed by the Bun binaries under the hardened runtime, and the cross-architecture `swift build`.
The first run of the `build` workflow on `macos-latest` is the real test; expect to fix small
things there. The darwin binaries were cross-compiled but never executed.

## Opening an unsigned build

Until a Developer ID certificate exists, the release is only ad-hoc signed and not notarized, so
macOS blocks the first open. Either:

- open System Settings > Privacy & Security, scroll to the blocked AgentControl message and click
  Open Anyway; or
- run `xattr -dr com.apple.quarantine /Applications/AgentControl.app` and open the app again.

The signing and notarization steps in `scripts/mac/sign-and-notarize.sh` run only when the Apple
secrets exist; without them the same script produces the ad-hoc signed app and the unsigned dmg.
There is no Homebrew cask and no in-app update yet.
