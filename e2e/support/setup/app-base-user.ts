import type { AppAccess, Session } from "./app.ts";
import { attemptApi } from "./app-attempt.ts";

/** What the user types in the New session dialog; each part may be left out. */
interface NewSessionChoices {
  prompt?: string;
  baseBranch?: string;
}

/** Starting sessions with or without a named base branch or a first prompt, through the SDK. */
export function appBaseUserOf(app: AppAccess) {
  const start = async (choices: NewSessionChoices): Promise<Session> => {
    await app.mockAgent.writeScript();
    const id = await app.sdk.sessions.start({
      agent: "mock",
      repoPath: app.repoPath,
      ...(choices.baseBranch === undefined ? {} : { baseBranch: choices.baseBranch }),
      ...(choices.prompt === undefined ? {} : { prompt: choices.prompt }),
    });
    return { id, title: choices.prompt ?? "new session" };
  };
  return {
    /** Starts a session and names no branch: it should start from the remote's latest trunk. */
    startsSessionWithoutABranch: (options: { prompt: string }) => start(options),
    /** Starts a session from this branch, a local one or a remote one such as "origin/main". */
    startsSessionFromBranch: (options: { prompt: string; baseBranch: string }) => start(options),
    /** Creates a session and writes no prompt: the agent is made ready and waits for the user. */
    createsSessionWithoutAPrompt: () => start({}),
    /** Tries to create a session with no prompt, and gets the app's answer whatever it is. */
    triesToCreateASessionWithoutAPrompt: () => attemptApi(start({})),
    /** Restarts the relay of this Mac, as the "Restart relay" button of its workspace does. */
    restartsTheRelayOfThisMac: () => app.sdk.workspaces.restartRelay("local"),
    /** The local workspace as the app describes it now. */
    looksAtThisMac: () => app.sdk.workspace.get(),
  };
}
