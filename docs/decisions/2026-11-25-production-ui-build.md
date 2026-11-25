# Releases serve a production build of the UI

Date: 25 Nov 2026. Owner decision: users run the built UI, not Vite's dev server. Measured on a
1,000-event streamed turn: 48 long tasks of 50 to 306 ms in dev mode (React development build,
`StrictMode` double renders, one module request per file), none with a production build.

## How the UI is served today

| Case | What serves it |
|---|---|
| Release (`main.ts`, no flags) | Vite dev server (`ui-template/server.ts`, a supervised child process) on `<data>/ui` |
| `bun dev` (`--ui-root packages/ui-template`) | The same dev server, on the source package: hot reload |
| E2E `uiDist` / `--ui-dist` | `serveBuiltUi`: a static folder, nothing built |
| E2E `withUi` | The dev server on `packages/ui-template` |
| A Modify change | Staging (`ui-staging/`) is only built and typechecked (a throw-away `vite build` in a temp folder). A change that passes is copied to `ui/` and the dev server hot-reloads it. There is no separate staging preview: the user reviews the change in the live UI and presses Keep or Undo |
| Keep | Commits `ui/` onto `main` in `ui.git`. No file changes |
| Undo, restore, rollback (`/_safe`) | `ui.git` writes a version into `ui/` and `ui-staging/`; the dev server reloads |
| Default-UI update merge | Merge in staging, checks, copy to `ui/`, then Keep commits the merge |
| `/_safe` | The app itself (`safe/`), never the UI folder. It does not change |

## Decision

1. **Where the output lives.** `<data>/ui-build/<key>/`: a sibling of `ui/`, `ui-staging/` and
   `ui.git/`. The Modify agent is fenced into `ui-staging/`, and the history never sees it
   (`ui.git` snapshots `ui/` only, and skips `dist`).
2. **What identifies a build.** `key = sha256(content of ui/ + the app release's version)`, the
   content being every file of the folder except `node_modules`, `dist` and dot-folders (the same
   rule as the history uses). Equal content gives an equal key, so the key is how the app knows
   the served build matches the UI: after Keep, Undo, restore, and an update merge, `ui/` holds
   the tree of `main`'s tip, and so the key of `ui/` is the key of that commit. While a change
   waits for Keep, `ui/` holds the change and the build matches it, which is what the user is
   reviewing. The release version is part of the key so an app update rebuilds the UI against the
   new SDK.
3. **One cache, keyed by content.** A build is written to `<key>.partial` and renamed to `<key>`
   when Vite succeeds; a folder that exists is complete. The Modify checks build staging through
   the same cache (`build(dir)`): so the build that passes the checks *is* the build of the change,
   and copying staging to `ui/` finds it already built (the key is equal). Undo and rollback find
   the older build still there. The newest three builds are kept (about 15 MB each), older ones are
   deleted after each successful build.
4. **When a build runs.** `sync()` makes the served build match `ui/`: compute the key; if it
   is already served, nothing; if it is cached or is the shipped prebuilt (below), serve it; else
   run `vite build`. `sync()` runs at app start, after promoting a change to `ui/`, after Keep
   (a safety net: normally nothing to do), after Undo, after restore, after the rollback of a
   change that waits, and after finishing an update. A folder edited by hand is picked up at the
   next start or the next of those; there is no file watcher (the Modify agent is the way to edit,
   and the dev server stays for developers). Syncs run one at a time.
5. **While a build runs or fails.** The previous good build keeps being served; the switch is one
   rename of the served folder, never a half-written folder. Open pages carry a tiny script that
   asks `GET /_ui-build` (`{serving, failed}`, nothing private) every 2 s and reloads when it
   changes: that is how a change shows up without HMR. If a build fails, the served build stays,
   every page gets a banner ("Your last change could not be built, so the version from before is
   shown. Open the recovery page.") linking to `/_safe`, and `/_safe` shows the build output. If
   there is no build at all (first start without a prebuilt one, or every build failed), the page
   is a plain "Preparing your UI" page that reloads itself, or a plain failure page with the
   output and the `/_safe` link. Never a blank page. Rollback on `/_safe` works as before and
   never waits for a build: Undo and restore return at once, and the served UI switches (the open
   page reloads) when the older version's build is there, instantly when it is cached.
6. **Start-up and prebuilt.** The release ships the default UI already built, as
   `resources/ui-template/dist/` (made once per release by `scripts/build/ui-resources.ts`; the
   build does not depend on the platform). On a first start, and on any start where `ui/` is still
   the default UI of this release, the app copies it into the cache: no wait. A user's changed UI
   is built once, when the change is checked, and found in the cache at the next start.
7. **Vite and the release.** Vite, `@vitejs/plugin-react`, Tailwind and the dependencies of the
   UI are already in the release's `node_modules` (the dev server and the Modify checks use them),
   so a build needs nothing more. The dev server (`server.ts`) stays for `bun dev` and the
   `withUi` tests; a release no longer starts it. The release still ships Vite for the builds.
8. **React and StrictMode.** `main.tsx` wraps the app in `StrictMode` only when
   `import.meta.env.DEV`, which Vite replaces by `false` in a build. The build runs with
   `NODE_ENV=production`, whatever the app's own environment is.

## Cost

Measured on a 4-core Linux machine, the compiled app, with the release folder run as an installed
app would be (see the end of this file for how).

- Release size: +15 MB (the prebuilt UI, `resources/ui-template/dist`), 710 to 725 MB. The release
  build takes one more `vite build`: 14.5 s to 23.8 s in total.
- Data folder: 15 MB per kept build, three at most.
- First start: the app listens after 0.94 s and answers the page at once with the shipped build
  (before: 1.4 to 1.6 s, with Vite starting, and about 3 s more for the UI to be on screen). No
  Vite process runs in a release any more.
- A build in the release (the binary acting as `bun` and running the shipped Vite): 8.5 s. A Modify
  change: the checks already built it, so `ready` comes no later than before.
- Rollback: instant when the older build is among the last three, else one build (about 8.5 s).
- After an app update, or a UI changed outside the app's knowledge: one build in the background,
  while the previous build is served.

This replaces the "no prebuilt `dist/` is shipped" line of `2026-11-23-release-layout.md`: it
measured the cost of a first start with the dev server, and a release now has no dev server.

## Rejected

- **Building at Keep instead of at promote.** The user must see the change before Keep, so the
  build has to exist when the change is promoted. Building twice (checks, then promote) doubles
  the wait for `ready`.
- **A file watcher on `ui/`.** More moving parts for a case (editing the folder by hand) that
  the app does not promise.
- **A `current` pointer file.** The cache is addressed by content; the newest folder by time is
  the fallback to show while a build runs. Nothing can point at a missing build.
- **A second Vite dev server for a staging preview.** There is no staging preview today; the
  promoted change in the live UI is the preview.
