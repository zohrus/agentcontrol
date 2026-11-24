import type { AppAccess, Session } from "../setup/app.ts";
import type { OpenShell } from "../setup/terminal-user.ts";

/** The session reports no changes and no files, rather than failing. */
export async function expectNothingToChangeYet(app: AppAccess, session: Session): Promise<void> {
  const diff = await app.sdk.sessions.diff(session.id);
  const files = await app.sdk.files.tree(session.id);
  if (diff.files.length === 0 && files.length === 0) return;
  throw new Error(
    `expected session "${session.title}" to have no changes and no files yet, but it has ${String(diff.files.length)} changes and ${String(files.length)} files`,
  );
}

/** Reading the file was refused with a message that says the session has no working copy. */
export function expectFileToBeUnreadableYet(outcome: string): void {
  if (/no working copy/i.test(outcome)) return;
  throw new Error(`expected the file to be refused as having no working copy yet, but ${outcome}`);
}

/** The terminal says the session's working copy could not be made. */
export async function expectRefusedBecauseTheWorkingCopyCouldNotBeMade(
  shell: OpenShell,
): Promise<void> {
  await shell.problems.waitFor(
    (problem) => /working copy could not be made/i.test(problem),
    "expected the terminal to say that the session's working copy could not be made",
  );
}

/** After the session was archived, its history holds nothing about an agent (not even one that failed to start). */
export async function expectNoAgentActivityAfterArchiving(
  app: AppAccess,
  session: Session,
): Promise<void> {
  const events = await app.sdk.sessions.events(session.id);
  const archivedAt = events.findIndex((event) => event.kind === "session-archived");
  const agentKinds = ["agent-started", "agent-exited", "acp", "prompt-sent"];
  const later = events.slice(archivedAt + 1).filter((event) => agentKinds.includes(event.kind));
  if (archivedAt >= 0 && later.length === 0) return;
  throw new Error(
    `expected nothing about an agent after archived session "${session.title}" ended, but it has ${later.map((event) => event.kind).join(", ")}`,
  );
}
