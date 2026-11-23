# Contributing

Thank you for looking. The full rules are in [AGENTS.md](AGENTS.md); this is the short version.

## How work lands

Most work here is done by coding agents, each in its own git worktree. There are no pull requests
in that loop. Checked work is rebased on `main` and pushed by one script:

```sh
bun run integrate <branch>            # rebase, run every check, push to main only if all pass
bun run integrate <branch> --dry-run  # the same, without the push
```

**If you are an outside contributor:** pull requests are welcome. A pull request is not merged
with the button. A maintainer takes your branch and lands it with `bun run integrate`, so it is
rebased and run through every check first. Your commits stay. If the checks fail, you will be asked
to fix them. Run `bun run check` before you open the pull request.

## Tests

End-to-end only, no unit tests. A test starts the real app and relay and drives them as a user
would. The only fake is the agent: a scripted mock in `e2e/support/mock-agent/`. Write the steps as
GIVEN / WHEN / THEN comments, with a three-line banner each, and one or two helper calls under each:

```ts
test("a session that asks to run a command is shown as waiting on you", async () => {
  // ********************************************************************
  // ** GIVEN the app is running with one local workspace
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();
  // AND the agent will ask permission to run `npm test` on its first turn
  app.mockAgent.willAskToRunCommand("npm test");

  // ********************************************************************
  // ** WHEN the user starts a session asking to add rate limiting
  // ********************************************************************
  const session = await app.user.startsSession({ prompt: "Add rate limiting" });

  // ********************************************************************
  // ** THEN the session list flags the session as waiting for approval
  // ********************************************************************
  await expectSessionWaitingForApproval(app, session);
  // AND the pending request names the `npm test` command
  await expectPendingRequestToRunCommand(app, session, "npm test");
});
```

One behaviour per test. No `if`, loops or sleeps in a test. Name helpers after the domain fact
(`expectSessionWaitingForApproval`), never `checkState`. Setup helpers go in
`e2e/support/setup/`, assertions in `e2e/support/expect/`. Line coverage from these tests must
stay at 95% or more.

## The gates

`bun run check` runs every gate and the tests: types, lint (complexity, function and file size),
dependency rules, dead code, duplicated code, formatting, audit. All of them break the build. When
a limit is hit, split the code. Never raise a limit or disable a rule to get through.
`bun run prove-gates` shows that each gate really fails on a bad sample.

## Adding a dependency

The bar is high. Use Bun's built-ins first. Add a library only if it saves hundreds of lines, is
owned by a known organisation or a long-standing maintainer, was released in the last 12 months,
has a permissive license and few dependencies. Pin the exact version and commit `bun.lock`. The
approved and refused lists are in AGENTS.md. Do not add one in a pull request without asking in an
issue first; a maintainer adds dependencies in one place.

## Decisions

A decision others will live with is a short file in [docs/decisions/](docs/decisions/), written in
the same change as the code. Decisions are not edited later: a new file replaces an old one. The
plan is [docs/plan.html](docs/plan.html); progress is [docs/status.html](docs/status.html).
