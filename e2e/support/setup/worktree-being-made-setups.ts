import type { SessionId } from "@agentcontrol/sdk";
import type { AppAccess, Session } from "./app.ts";
import {
  aSessionWhoseWorktreeBranchIsTaken,
  startsASessionWithoutABranch,
  theUserChoosesTheSessionId,
} from "./create-at-once-setups.ts";
import { expectSessionToBe } from "../expect/ready-session-expectations.ts";
import { SHELL_RELAY_ENV } from "./start-app-with-shell.ts";
import { type SlowSetup, theRepoSetupWaitsForTheTest } from "./slow-setup.ts";
import { startAppWithLocalWorkspace } from "./start-app.ts";
import { type OpenShell, openShell } from "./terminal-user.ts";

/** The app with a shell the terminal tests can use. */
export function startAppWithShell() {
  return startAppWithLocalWorkspace({ relayEnv: SHELL_RELAY_ENV });
}

/** A client asks for a file of the session, and the app's words when it was refused. */
export async function asksForTheFileOfASessionBeingMade(
  app: AppAccess,
  session: Session,
): Promise<string> {
  return app.sdk.files.read({ id: session.id, path: "README.md" }).then(
    () => "it was read",
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  );
}

/** A session whose worktree branch is taken, created while the remote hangs. */
export async function aSessionBeingMadeWhoseBranchIsTaken(app: AppAccess): Promise<Session> {
  const id: SessionId = await aSessionWhoseWorktreeBranchIsTaken(app);
  return theUserChoosesTheSessionId(app, id);
}

/** The user opens a terminal of the session: it is returned as it ends or fails. */
export function asksForATerminalOfASessionBeingMade(app: AppAccess, session: Session): OpenShell {
  return openShell(app, { session });
}

/** A session that has been created and whose setup script waits for the test. */
export async function startsASessionWhoseSetupWaits(
  app: AppAccess,
): Promise<{ session: Session; setup: SlowSetup }> {
  const setup = await theRepoSetupWaitsForTheTest(app);
  const session = await startsASessionWithoutABranch(app);
  return { session, setup };
}

/** The user archives the session. */
export async function archivesTheSession(app: AppAccess, session: Session): Promise<void> {
  await app.sdk.sessions.archive(session.id);
}

/** Another session goes all the way to ready, which takes a full agent start. */
export async function aSecondSessionBecomesReady(app: AppAccess): Promise<void> {
  const second = await startsASessionWithoutABranch(app);
  await expectSessionToBe(app, { session: second, status: "ready" });
}
