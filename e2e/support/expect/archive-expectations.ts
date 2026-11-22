import { access } from "node:fs/promises";
import type { SessionsArchiveResult } from "@agentcontrol/protocol";
import { git } from "../setup/git.ts";
import type { RelayAccess, Session } from "../setup/relay.ts";
import { worktreeOf } from "../setup/session-events.ts";
import { expectListedAs, seesSession } from "./session-list.ts";

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

/** The relay did not archive; it warned and named exactly these uncommitted files. */
export function expectArchiveToWarnAboutFiles(
  result: SessionsArchiveResult,
  files: string[],
): void {
  if (result.archived) {
    throw new Error(`expected the archive to warn about ${files.join(", ")}, but it archived`);
  }
  if (JSON.stringify(result.uncommittedFiles) !== JSON.stringify(files)) {
    throw new Error(
      `expected the archive to warn about ${files.join(", ")}, but it listed ${result.uncommittedFiles.join(", ")}`,
    );
  }
}

/** The warned-about session is still active, with its worktree untouched. */
export async function expectSessionNotArchived(
  relay: RelayAccess,
  session: Session,
): Promise<void> {
  const summary = await seesSession(relay, session);
  if (summary.status === "archived") {
    throw new Error(`expected session "${session.title}" not to be archived, but it is`);
  }
  if (!(await exists(await worktreeOf(relay, session)))) {
    throw new Error(`expected the worktree of session "${session.title}" to still exist`);
  }
}

/** The session's worktree folder is gone, but its git branch is still in the repo. */
export async function expectWorktreeRemovedButBranchKept(
  relay: RelayAccess,
  session: Session,
): Promise<void> {
  if (await exists(await worktreeOf(relay, session))) {
    throw new Error(`expected the worktree of session "${session.title}" to be removed`);
  }
  const { branch } = await seesSession(relay, session);
  const kept = await git(relay.repoPath, "branch", "--list", branch);
  if (kept.trim() === "") {
    throw new Error(`expected branch "${branch}" to be kept in the repo, but it is gone`);
  }
}

/** The session list still shows the session, as archived. */
export async function expectSessionListedAsArchived(
  relay: RelayAccess,
  session: Session,
): Promise<void> {
  await expectListedAs(relay, { session, status: "archived", wanted: "archived" });
}
