import { join } from "node:path";
import type { SessionId } from "@agentcontrol/sdk";
import type { AppAccess, Session } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";

/** The session is in the list as "starting" and has no base branch yet. */
export function expectSessionToBeListedAsStarting(app: AppAccess, session: Session): Promise<void> {
  return eventually(`expected session "${session.title}" to be listed as starting`, async () => {
    const listed = (await app.sdk.sessions.list()).find((row) => row.id === session.id);
    if (listed === undefined) return "the list does not have it";
    if (listed.status !== "starting") return `it is ${listed.status}`;
    return listed.baseBranch === "" ? undefined : `its base is already ${listed.baseBranch}`;
  });
}

/** Creating a session with this id is refused, with a message that says this. */
export async function expectCreationToBeRefused(
  app: AppAccess,
  call: { id: SessionId; saying: string },
): Promise<void> {
  const { id, saying } = call;
  const outcome = await app.sdk.sessions
    .start({ agent: "mock", repoPath: app.repoPath, sessionId: id })
    .then(
      () => "it was created",
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );
  if (outcome.includes(saying)) return;
  throw new Error(
    `expected creating session ${id} again to be refused saying "${saying}", but ${outcome}`,
  );
}

/** A file written in the session's worktree is reported by the live stream. */
export async function expectFileChangesToBeHeard(
  app: AppAccess,
  call: { session: Session; path: string },
): Promise<void> {
  const { session, path } = call;
  const created = await app.streamed.waitFor(
    (event) => event.sessionId === session.id && event.kind === "session-created",
    `expected session "${session.title}" to have been created`,
  );
  if (created.kind !== "session-created") return;
  await Bun.write(join(created.payload.worktreePath, path), "notes\n");
  await app.fileChanges.waitFor(
    (change) => change.sessionId === session.id && change.paths.includes(path),
    `expected the live stream to report ${path} changed in session "${session.title}"`,
  );
}

/** Asking for a session with that id was refused, not carried out. */
export function expectTheIdToBeRefused(outcome: string): void {
  if (outcome === "it was created") {
    throw new Error("expected an id that is not a UUID to be refused, but the session was created");
  }
}

/** Of the answers to requests for one session, exactly one says it was created. */
export function expectExactlyOneToHaveBeenCreated(outcomes: readonly string[]): void {
  const created = outcomes.filter((outcome) => outcome === "it was created").length;
  if (created === 1) return;
  throw new Error(
    `expected exactly one of two requests to create the session, but ${String(created)} did: ${outcomes.join(" | ")}`,
  );
}
