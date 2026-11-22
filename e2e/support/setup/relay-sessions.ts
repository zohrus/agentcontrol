import { expectSessionWaitingForApproval } from "../expect/session-expectations.ts";
import type { Session } from "./relay.ts";
import { type RunningRelay, startRelayWithLocalRepo } from "./start-relay.ts";

/** A relay with a session whose agent is waiting for approval to run `npm test`. */
export async function startRelayWithSessionWaitingToRunNpmTest(
  options: { thenReplies?: string } = {},
): Promise<{ relay: RunningRelay; session: Session }> {
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willAskToRunCommand("npm test");
  if (options.thenReplies) relay.mockAgent.willReply(options.thenReplies);
  const session = await relay.user.startsSession({ prompt: "Run the tests" });
  await expectSessionWaitingForApproval(relay, session);
  return { relay, session };
}

/** A relay with a session whose agent has edited the file and finished its turn. */
export async function startRelayWithSessionWhereAgentEdited(
  path: string,
): Promise<{ relay: RunningRelay; session: Session }> {
  const relay = await startRelayWithLocalRepo();
  relay.mockAgent.willEditFile(path);
  const session = await relay.user.startsSession({ prompt: "Make the change" });
  await relay.user.waitsForTheAgentToFinish(session);
  return { relay, session };
}
