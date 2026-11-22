import type { FileContent } from "@agentcontrol/sdk";
import { expectSessionWaitingForReply } from "../expect/app-expectations.ts";
import type { Session } from "./app.ts";
import type { RunningApp } from "./start-app.ts";

/** A finished session in the app whose README.md the user has open. */
export async function userOpensReadmeOfFinishedSession(
  app: RunningApp,
): Promise<{ session: Session; opened: FileContent }> {
  app.mockAgent.willReply("Ready");
  const session = await app.user.startsSession({ prompt: "Look at the readme" });
  await expectSessionWaitingForReply(app, session);
  const opened = await app.user.opensFile(session, "README.md");
  return { session, opened };
}
