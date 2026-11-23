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

Locally: `bun run build` writes the binaries and `dist/manifest.json`.
`bun scripts/smoke-binary.ts dist/agentcontrol-relay-linux-x64` runs the Linux relay for real.
On a Mac: `swift build -c release` in `packages/mac`, then `scripts/mac/make-app.sh arm64` and
`scripts/mac/sign-and-notarize.sh arm64` (use `x64` for Intel).

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
- The relay inside a compiled binary cannot start its own daemon until the one-line fix in
  `packages/relay/src/daemon/bridge.ts` is made (see below).

## Known issue: compiled relay and its daemon

`bridge.ts` starts the daemon with `spawn(process.execPath, [mainFile, "daemon", ...])`. In a
compiled binary `process.execPath` is the binary itself and `mainFile` is a path inside the
virtual `/$bunfs/` folder, so the child sees `mainFile` as its command and exits with the usage
message. The fix: leave `mainFile` out when compiled, for example

```ts
const entryArgs = import.meta.dir.startsWith("/$bunfs/") ? [] : [mainFile];
spawn(process.execPath, [...entryArgs, "daemon", "--data-dir", dataDir], { ... });
```

This was checked with a patched copy of the relay: `bun scripts/smoke-binary.ts <binary> --autostart`
passes with the fix and fails without it. Add `--autostart` to the CI smoke step once the fix lands.

## What could not be verified on Linux

Everything Mac-specific was written without running it: the Swift menu bar app (never compiled),
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
