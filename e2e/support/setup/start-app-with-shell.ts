import type { AppAccess, Session } from "./app.ts";
import { type RunningApp, startAppWithLocalWorkspace } from "./start-app.ts";

/**
 * The relay's environment for terminal tests: `/bin/sh` as the user's shell (it exists in CI),
 * and two variables the relay uses for itself, which a user's shell must never inherit.
 */
export const SHELL_RELAY_ENV = {
  SHELL: "/bin/sh",
  BUN_BE_BUN: "1",
  AGENTCONTROL_ADAPTER_CACHE: "/relay/internal/cache",
};

/** The app with a finished session whose worktree the terminal opens in. */
export async function startAppWithASession(
  options: { withUi?: boolean } = {},
): Promise<{ app: RunningApp; session: Session }> {
  const app = await startAppWithLocalWorkspace({ relayEnv: SHELL_RELAY_ENV, ...options });
  app.mockAgent.willReply("Done");
  const session = await app.user.startsSession({ prompt: "Add rate limiting" });
  await waitUntilTheSessionAwaitsTheUser(app, session);
  return { app, session };
}

async function waitUntilTheSessionAwaitsTheUser(app: AppAccess, session: Session): Promise<void> {
  await app.streamed.waitFor(
    (event) => event.sessionId === session.id && event.kind === "turn-ended",
    `expected session "${session.title}" to finish its first turn`,
  );
}
