import { join } from "node:path";
import type { Session } from "./app.ts";
import { fakeCodeServerCommand } from "./fake-code-server-command.ts";
import { startsSessionThatFinished } from "./preview-sessions.ts";
import { type RunningApp, type StartOptions, startAppWithLocalWorkspace } from "./start-app.ts";

/** The relay finds `code-server` and it is the scripted stand-in. */
export const FAKE_CODE_SERVER_ENV = {
  AGENTCONTROL_CODE_SERVER_CMD: JSON.stringify(fakeCodeServerCommand()),
};

/** The relay's command for code-server is a program that does not exist: it is not installed. */
export const NO_CODE_SERVER_ENV = {
  AGENTCONTROL_CODE_SERVER_CMD: JSON.stringify(["/nonexistent/code-server"]),
};

/** The relay's own data folder inside the app's: where it keeps code-server's sockets and settings. */
export const relayDataOf = (app: Pick<RunningApp, "dataDir">): string => join(app.dataDir, "relay");

/** An app whose relay finds code-server, with one finished session. */
export async function startAppWithCodeServer(
  options: StartOptions = {},
): Promise<{ app: RunningApp; session: Session }> {
  const relayEnv = { ...FAKE_CODE_SERVER_ENV, ...options.relayEnv };
  const app = await startAppWithLocalWorkspace({ ...options, relayEnv });
  const session = await startsSessionThatFinished(app, "Add rate limiting");
  return { app, session };
}

/** An app whose relay has no code-server, with one finished session. */
export async function startAppWithoutCodeServer(
  options: StartOptions = {},
): Promise<{ app: RunningApp; session: Session }> {
  return startAppWithCodeServer({ ...options, relayEnv: NO_CODE_SERVER_ENV });
}
