# Starting and archiving a session: every step says how long it took, and the waiting is shorter

Date: 24 Nov 2026. Status: decided.

The owner asked "why does it take so long to start and archive a session?" and nothing in the app
could answer. Now every step of both says how long it took, and the time that could be avoided was
removed (numbers below; what did not help was dropped).

## What the user sees

The session's setup block is one line that opens into the steps. Collapsed: `Worktree setup finished
· 12 s` (the whole time, first line to last). Open: one line per step with its own time, then what
the setup script printed.

```
✓ Asked origin: its default branch is main      0.4 s
✓ Fetched origin/main                           2.1 s
✓ Checked out 4,812 files                       6.3 s
✓ Copied 1 setup file                           2 ms
✓ Ran the setup script                          41 s
✓ Started the Claude Code adapter               3.4 s
✓ Opened the agent's session                    0.3 s
```

A step that is still going shows `…` and the time so far, counting every second. A step that
failed is red with the time it ran. Archiving has the same block, `Archived · 1.2 s`: the check for
uncommitted changes, stopping the agent, closing terminals, removing the worktree, and later (after
`session-archived`) deleting the old folder. The first-use download of an adapter is a step of its
own (`Downloaded the Claude Code adapter`), only when it happens.

## Contract (backward compatible)

No new event kind. `setup-output` has an optional `step`: `{ id, phase?, state: running | done |
failed, label, durationMs? }`. `phase` is `setup` (default) or `archive`. The line's `text` is the
same words with the time, so an older reader shows the same lines. A running step has no
`durationMs`; the UI counts from the event's time. `formatDuration` (`protocol`) writes `340 ms`,
`2.1 s`, `41 s`, `2 min 5 s` for both the relay and the UI. Logs without steps read as before.

Durations are measured by the relay (`steps/`: a `Stopwatch` and `createTimed`; `worktrees/` and
`agents/` receive a `Timed` function and stay free of events). Tests fix every duration with
`AGENTCONTROL_STEP_MS=1500` in the relay's environment (the clock edge, so nothing sleeps).
`AGENTCONTROL_HOLD_DELETION_UNTIL=<file>` makes the background deletion of an archived folder wait for
that file, so a test can look at the world while the deletion is still going. Both are inert unless
set.

## Measured (before and after)

`bun scripts/bench-start-archive.ts --runs 5 --boot 3000` (the script is in the repository). A
repository with 20,000 tracked source files in 400 folders, a local bare remote, the mock agent, a
setup script that makes 50,000 small files in an ignored `node_modules`, adapter boot simulated at
3 s (the mock sleeps before it listens). Linux VM, 4 cores, ext4; medians of 5 runs, milliseconds.
The "before" runs are the code at `origin/main` with the same script. The VM is noisy: the setup
script alone ranged from 1.2 s to 8 s from run to run in both versions (the 50,000 file writes),
so read the rows that the change touched, not the total.

| Step | Before | After |
|---|---|---|
| start() returns | 9 | 16 |
| 1. trunk lookup and fetch (local remote) | 24 | 31 |
| 2. checkout and copy files | 4,590 | 818 |
| 3. setup script (noise: 1.2 to 8 s in both) | 5,340 | 7,106 |
| 4. adapter start and `initialize`, after the script | 3,075 | 0 (ran during 1 to 3) |
|    `session/new`, after the script | (in 4) | 4 |
| Click to ready | 13,065 | 7,836 |
| archive() returns | 942 | 105 |
| the old folder is gone | 942 | 105 + deleted in the background (about 0.7 s) |

What each command costs on its own, by hand, on the same repository (`--commands`; one run, ms):
`git ls-remote` 5, `git fetch` (nothing new) 12, `git worktree add` 940 to 1,880 (one core), the setup
script 6,900, `git status -uall` 55 to 94 with the 50,000 ignored files present, rename the folder
aside 0, `git worktree prune` 3, `rm -rf` of the folder 660 to 800, `git worktree remove --force` 740
to 850.

A remote that answers after 400 ms per connection (`--latency 400`, 2,000 files; first row of start,
median of 3): 831 before, 435 after.

## What changed, with the evidence

1. **The adapter starts while git works.** `relay/sessions` starts the adapter process and runs
   `initialize` (and the first-use download) as soon as the session exists, in the relay's worktrees
   folder; only `session/new` waits for the folder and the setup script. Saves the adapter's whole
   start: 3.1 s in the simulated run (hidden behind the checkout and the script), measured
   not at all with the real adapter (see below). Failures of the adapter are shown after the setup,
   as before. An adapter that was started for a session that is archived or failed is stopped.
2. **Parallel checkout** (`git -c checkout.workers=0 worktree add`). 20,000 files in 400 folders,
   6 alternating rounds after `sync`: 5.7 s plain, 0.7 s with workers (0.7 s with 4 workers);
   tiny files: 4.0 s and 1.1 s. With all 20,000 files in one folder there was no consistent gain
   (directory lock): real repositories are not flat. The user sees the same worktree.
3. **One network round trip less.** `ls-remote --symref` still decides which branch is the trunk
   (the guarantee in `2026-11-24-default-base.md` is unchanged), but the fetch of the branch the
   repository last knew (`origin/HEAD`, else `origin/main`, `origin/master`) now starts alongside it.
   If the remote's answer is the same branch the fetch is done; if not (it renamed its trunk) the
   right branch is fetched afterwards, so the result is the same as before. 831 ms to 435 ms at
   400 ms per connection. The step line of the fetch then shows only the time left after the lookup.
4. **Archive does not wait for the deletion.** After the checks, the folder is renamed into
   `<worktrees>/.deleting/` (same file system, instant), git's record of the worktree
   (`.git/worktrees/<name>`, found by the `gitdir` file that points at this folder) is deleted,
   `session-archived` is recorded, and the moved folder is deleted in the background. Not
   `git worktree prune`: that removes the records of every worktree whose folder is missing, such as
   a user's own on an unplugged disk. Failure handling:
   - the record cannot be deleted: the folder is moved back and the archive fails, nothing half done;
   - the folder cannot be moved, or git's record of it cannot be found (the `gitdir` file is read as
     an absolute or a relative path, as `worktree.useRelativePaths` writes it): the old, slow
     `git worktree remove --force`;
   - the process dies after the move and before `session-archived`: the session is still active,
     its folder is missing; archiving it again finds no folder and still deletes the record, so
     git forgets the worktree (the branch cannot be deleted while git thinks it is checked out);
   - the relay stops during the deletion: the next relay deletes `.deleting/` when it starts;
   - uncommitted changes are still warned about first, before anything moves; the branch and the
     event log are kept as before.
5. **A stubborn agent cannot hold an archive.** The adapter runs in its own process group (it starts
   a CLI of its own); stopping sends SIGTERM to the group and, if anything of the group still runs
   after 2 s (the adapter itself, or the CLI after the adapter left), SIGKILL to the group. Before,
   `kill()` + `await exited` waited for ever on an agent that ignored SIGTERM (the test took the
   whole 40 s timeout). The check of the real adapter's behaviour is open (see below).
6. **The check for uncommitted changes uses `--no-optional-locks`**, so it never rewrites the index
   the agent may be using. It was already fast: `git status -uall` does not walk ignored folders
   (55 to 94 ms with 50,000 ignored files). No speed-up, kept for the lock.

## Tried and dropped

- **Not watching the worktree while the setup script runs.** The file watch starts as soon as the
  folder exists and watches the 50,000 files the script makes. Controlled test (6 alternating
  rounds, `sync` between): the script took 5.9 s watched and 5.1 s unwatched on Linux, about 15 %.
  An earlier look at the whole session seemed to show 4 times, which was the VM's own noise.
  Too little for the extra state; not done. On a Mac the watcher is FSEvents: not measured.
- **`core.fsync=none` for the checkout:** no difference (4.0 s against 3.8 s).
- **A faster check for uncommitted files:** nothing to gain (above).
- **`copy-files` glob over the main repository** (`**/.env*` with 50,000 files in `node_modules`): 20 ms.
- Repeated `git` calls for the same fact in the start path: none found worth merging.

## Not measured (no Mac, no real agent)

- The real adapters' start time. The simulated 3 s is a guess about what loading Node, the adapter
  and its CLI costs; with the real one the gain from step 1 is whatever that really is, up to
  the length of the checkout and the script. Also unverified: that `claude-agent-acp` and
  `codex-acp` do not use their own process folder (they start in the worktrees folder now; the
  session's folder is given to `session/new`).
- macOS: APFS file creation and `checkout.workers`, the rename aside, FSEvents, and the relay when
  its adapters are in their own process group (a relay killed with SIGKILL no longer takes them
  down with it; they end when their input closes).
- A remote over ssh or https to a real host (only a local bare repository with an added delay).
