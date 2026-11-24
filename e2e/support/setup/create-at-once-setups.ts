import { randomUUID } from "node:crypto";
import type { SessionId } from "@agentcontrol/sdk";
import type { AppAccess, Session } from "./app.ts";
import { git } from "./git.ts";

/** The session's list title when the user gave none and sent no prompt yet. */
const NEW_SESSION = "new session";

const titled = (app: AppAccess, id: SessionId): Session => ({
  id,
  title: `${app.repoPath.split("/").at(-1) ?? ""} – ${NEW_SESSION}`,
});

/** The user creates a session in the repo and names no branch, so it starts from the remote's trunk. */
export async function startsASessionWithoutABranch(app: AppAccess): Promise<Session> {
  await app.mockAgent.writeScript();
  const id = await app.sdk.sessions.start({ agent: "mock", repoPath: app.repoPath });
  return titled(app, id);
}

/** A session id (made here, as a client that shows the session before the app answers would). */
export function anId(): SessionId {
  return randomUUID() as SessionId;
}

/** The user creates a session and chooses its id; without one a new id is made. */
export async function theUserChoosesTheSessionId(app: AppAccess, id = anId()): Promise<Session> {
  await app.mockAgent.writeScript();
  const started = await app.sdk.sessions.start({
    agent: "mock",
    repoPath: app.repoPath,
    sessionId: id,
  });
  return titled(app, started);
}

/** The repo already has a branch with the name the worktree of the session with the returned id will get. */
export async function aSessionWhoseWorktreeBranchIsTaken(app: AppAccess): Promise<SessionId> {
  const id = anId();
  await git(app.repoPath, "branch", `agentcontrol/${id}`);
  return id;
}

/** What came of asking for a session with this id: nothing wrong, or the app's words. */
export async function tryToCreateWithId(
  app: AppAccess,
  id: string,
  baseBranch?: string,
): Promise<string> {
  await app.mockAgent.writeScript();
  const started = app.sdk.sessions.start({
    agent: "mock",
    repoPath: app.repoPath,
    sessionId: id as SessionId,
    ...(baseBranch === undefined ? {} : { baseBranch }),
  });
  return started.then(
    () => "it was created",
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  );
}

/** The user asks for a session from a base branch that does not exist, with an id of their own. */
export function createsFromAMissingBranch(app: AppAccess, id: SessionId): Promise<string> {
  return tryToCreateWithId(app, id, "no-such-branch");
}

/** The hash of a file with no content, which is what a file that does not exist yet has. */
const NO_CONTENT_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** A client writes a file that does not exist yet into the session's worktree. */
export function writesANewFile(
  app: AppAccess,
  call: { session: Session; path: string; content: string },
): Promise<string> {
  const { session, path, content } = call;
  return app.sdk.files.write({ id: session.id, path, content, expectedHash: NO_CONTENT_HASH });
}

/** The answers to two create requests with one id, sent together. */
export function createsWithTheSameIdTwiceAtOnce(app: AppAccess): Promise<string[]> {
  const id = anId();
  return Promise.all([tryToCreateWithId(app, id), tryToCreateWithId(app, id)]);
}
