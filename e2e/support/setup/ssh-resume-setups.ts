import { expectSessionWaitingForReply } from "../expect/app-expectations.ts";
import { appResumeUserOf } from "./app-resume-user.ts";
import { startAppWithSshHost } from "./start-app-with-ssh-host.ts";

/** An ssh workspace with a session whose agent said "Still here" and waits for a reply. */
export async function startsSessionWaitingForAReplyOnTheHost() {
  const { app, host, user } = await startAppWithSshHost();
  const workspace = await user.addsTheHost();
  host.mockAgent.willReply("Still here");
  const session = await user.startsSessionOn(workspace, { prompt: "Check in" });
  await expectSessionWaitingForReply(app, session);
  return { app, host, user, workspace, session };
}

/** The host's next agent has an empty script; the user resumes the session, which starts that agent. */
export async function resumesOnTheHost(
  setup: Awaited<ReturnType<typeof startsSessionWaitingForAReplyOnTheHost>>,
): Promise<void> {
  const { app, host, session } = setup;
  host.mockAgent.startsNewScript();
  await host.mockAgent.writeScript();
  await appResumeUserOf(app).resumesSession(session);
}
