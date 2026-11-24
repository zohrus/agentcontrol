import type { RunningRelay } from "./start-relay.ts";

/** The next agent process starts from a new script that only replies. */
function nextAgentReplies(relay: RunningRelay, reply: string): void {
  relay.mockAgent.startsNewScript();
  relay.mockAgent.willReply(reply);
}

/** The next agent can load the earlier session, replaying `history`, and then replies. */
export async function nextAgentCanLoadTheEarlierSessionAndReplies(
  relay: RunningRelay,
  call: { history: string[]; reply: string },
): Promise<void> {
  nextAgentReplies(relay, call.reply);
  relay.mockAgent.canLoadEarlierSession(call.history);
  await relay.mockAgent.writeScript();
}

/** The next agent starts and then dies by itself before it is given any prompt. */
export async function nextAgentDiesRightAfterStarting(relay: RunningRelay): Promise<void> {
  relay.mockAgent.startsNewScript();
  relay.mockAgent.diesRightAfterStarting();
  await relay.mockAgent.writeScript();
}

/** The next agent cannot load an earlier session at all, and replies. */
export async function nextAgentCannotLoadAndReplies(
  relay: RunningRelay,
  reply: string,
): Promise<void> {
  nextAgentReplies(relay, reply);
  await relay.mockAgent.writeScript();
}

/** The next agent offers to load the earlier session but fails to, and replies. */
export async function nextAgentFailsToLoadAndReplies(
  relay: RunningRelay,
  reply: string,
): Promise<void> {
  nextAgentReplies(relay, reply);
  relay.mockAgent.failsToLoadEarlierSession();
  await relay.mockAgent.writeScript();
}
