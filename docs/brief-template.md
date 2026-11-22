# Agent brief template

Copy this into the agent's prompt and fill every `<...>`. Keep it under one page: point to file
paths, never paste code.

```
Goal: <one sentence>

Setup (first, in your own git worktree):
  git fetch origin main
  git reset --hard origin/main          # your branch must start at origin/main
  bun install --frozen-lockfile
Read AGENTS.md fully and follow it. Limits break the build; never eslint-disable.

You own (edit only these paths):
  <path>, <path>
Shared files you may touch, append-only and small: <path or "none">
Read-only contracts (do not change; if one is wrong, stop and report):
  <packages/protocol/... or other paths>
E2E behaviours to cover (each one test, GIVEN/WHEN/THEN, in <e2e folder>):
  - <what the user sees>
  - <what the user sees>

Never: git add -A / git add . / git commit -a, a formatter or linter with --write on the whole
repo, adding or upgrading a dependency (ask in your report), git push, git commit --no-verify,
editing eslint.config.js or any limit.

Verify as you go:
  bun run check:quick                   # seconds; run it often
  bun test <your e2e files>
Before handing back:
  1. bun run check                      # every gate and the tests, all green
  2. /code-review on your diff; fix every bug; repeat until it reports none
  3. bun run done <owned paths...>      # prints the DONE-REPORT; must exit 0
Commit by path on your branch (git add <your paths>; git commit). Do not push; the
orchestrator lands it with `bun run integrate <branch>`.

Report (under 300 words), in this order:
  - what you built and the behaviours covered
  - the DONE-REPORT block from `bun run done`, with `code-review:` filled in
    (that you ran /code-review, what it found, that the last run was clean)
  - decisions others will live with (a file in docs/decisions/, or "Decisions: none")
  - dependencies or shared-file changes you need from the orchestrator
  - anything you skipped and why; your commit hash(es)
```

Why each part exists: syncing to `origin/main` avoids building on a stale base; owned paths and
read-only contracts keep parallel agents from colliding; `bun run done` turns "did you follow the
rules" into a machine-checked block; commit by path keeps one agent's files out of another's.
