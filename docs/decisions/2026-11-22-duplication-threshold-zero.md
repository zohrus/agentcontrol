# Duplication threshold 0, gate proofs in CI
Date: 2026-11-22   Author: Claude
## Context
jscpd's threshold was a percentage of the whole codebase (1%). As the code grew, 7 clones (0.57%) passed, and the proof case "jscpd: duplicated code" stopped failing on its deliberately duplicated sample.
## Decision
Threshold 0: any clone of 50+ tokens fails the build, whatever the codebase size. jscpd scans packages, e2e, spike and scripts; it skips node_modules, dist, generated migrations (packages/app/drizzle) and recorded fixtures (e2e/fixtures), with the reasons noted in the `"//"` key of `.jscpd.json`. The 7 existing clones were removed by sharing code (`linesOf` now lives in `packages/protocol`; e2e setup helpers hold the repeated GIVEN steps). `bun run prove-gates` runs as its own CI job, so a gate that silently stops working is caught on the next push.
## Rejected
A smaller percentage (still dilutes as code grows); ignore patterns or `jscpd:ignore` comments (hide clones instead of removing them).
## Consequences
Repeated test setup goes into a named helper in `e2e/support/setup/`. Limits only go down.
