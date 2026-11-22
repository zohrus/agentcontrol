# 0001 Development loop decisions
Date: 2026-11-22   Author: orchestrator (from docs/dev-loop-review.md)

## Context
Seven agents work in parallel and `main` has never been reliably green. These decisions set the
loop; they are listed together because they were made together.

## Decision
- **No pull requests.** Work lands with `bun run integrate <branch>`: rebase in a scratch
  worktree, full check, then fast-forward `main`. If `main` goes red, revert first.
- **Dependabot** is grouped into one weekly update per ecosystem. The orchestrator applies the
  updates by hand with `ALLOW_DEP_CHANGE=1`; agents never change dependencies (a pre-commit hook
  enforces it).
- **End-to-end tests only**, with at least 95% line coverage measured from that suite.
- **TypeScript is pinned to 6.0.x** until typescript-eslint supports 7. Dependabot ignores
  TypeScript major bumps.
- **Releases must be 14 days old** (`minimumReleaseAge` in `bunfig.toml`) before we install them.
- **Overrides** pin `esbuild` (0.25.12), `minimatch` (11.0.9) and `dompurify` (3.4.17), added with the gates so `bun audit` passes (the original reason was not written down).

## Rejected
Branch protection with required pull requests (the owner does not use them); a coverage number
from unit tests (AGENTS.md: no unit tests).

## Consequences
Remove an override when the packages that need it have moved past the affected versions. Revisit
the TypeScript pin when typescript-eslint announces TypeScript 7 support.
