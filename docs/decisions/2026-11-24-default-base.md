# A new session starts from the latest remote trunk

Date: 24 Nov 2026. Status: decided.

## Decision

When the user names no base branch, the relay fetches the repository's remote and starts the
session's worktree from the tip of the remote's default branch (`origin/main`, `origin/master`,
whatever the remote's HEAD is). `baseBranch` in `relay/sessions.create` is optional; a request that
names a branch behaves as before (local or remote branch, used as given).

## How the trunk is found

`git ls-remote --symref <remote> HEAD`, then `git fetch <remote> +refs/heads/<trunk>:refs/remotes/<remote>/<trunk>`.
The remote is `origin`, else the first remote.

Why not `refs/remotes/origin/HEAD` (or `git remote set-head origin --auto`), checked on git
2.x with local bare repositories:

- A repository set up with `git remote add origin ...` plus `git fetch` has no `origin/HEAD`:
  `symbolic-ref refs/remotes/origin/HEAD` fails with "is not a symbolic ref". Only `git clone` sets it.
- When the remote renames its trunk (`main` to `develop`), a cloned repository keeps pointing at
  `origin/main`. `ls-remote --symref` answered `ref: refs/heads/develop HEAD`.
- `set-head --auto` would work too (it asks the remote the same question) but writes
  repository state as a side effect on every session start. `ls-remote` only reads, and the fetch
  with an explicit refspec updates exactly the one remote-tracking branch we start from, even in
  a single-branch clone.

The fetch and `ls-remote` run with `GIT_TERMINAL_PROMPT=0` and a 15 second limit for each of the two commands, so a missing
credential or a hanging network ends in the offline fallback instead of freezing the start.

## What the session stores and the diff compares with

The resolved start point is stored as the session's `baseBranch` (for example `origin/main`), in the
`session-created` event, the summary, the session header ("from origin/main") and the database. The
diff and the "base" version of a file use `git merge-base <baseBranch> HEAD`, which for a fresh
session is its own first commit: 0 changes, even when the local `main` is behind the remote.
The worktree branch is created with `--no-track`, so it never gets the trunk as its upstream.

## Fallbacks (each is a plain line in the session's setup output, never a failure)

- No remote: starts from the checked-out local branch (or the commit when HEAD is detached) and says
  "This repository has no remote, so the session starts from the local main."
- The remote cannot be reached or has no default branch (offline, no access): starts from the last
  known remote trunk (`origin/HEAD` if set, else `origin/main`, `origin/master`) and says it may be
  out of date.
- Unreachable and nothing known about the remote's branches: the local branch, with the reason.

## Dialog

The branch field is optional and sits under "Advanced": "Starts from the latest <trunk> on the
remote. Change it only to start from another branch." Typing a branch works as before.
