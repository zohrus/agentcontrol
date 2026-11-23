import type { AppAccess, Session } from "../setup/app.ts";
import { updatesOf } from "../setup/updates.ts";

const isReply =
  (text: string) =>
  (event: Parameters<typeof updatesOf>[0]): boolean =>
    updatesOf(event).some((update) => update.type === "agent-text" && update.text === text);

/** The app's saved history of the session holds the agent's reply without its normalised update. */
export async function expectSavedHistoryToLackUpdates(
  app: AppAccess,
  call: { session: Session; reply: string },
): Promise<void> {
  const events = await app.sdk.sessions.events(call.session.id);
  if (events.some(isReply(call.reply))) {
    throw new Error(
      `expected the saved history of "${call.session.title}" to lack the update for "${call.reply}", but it holds it`,
    );
  }
}

/** The live stream delivered the reply's event once more, now with its normalised update. */
export async function expectLiveStreamToDeliverTheReplyAgain(
  app: AppAccess,
  call: { session: Session; reply: string },
): Promise<void> {
  await app.streamed.waitFor(
    (event) => event.sessionId === call.session.id && isReply(call.reply)(event),
    `expected the live stream to deliver the reply "${call.reply}" with its update after the relay got a newer translation`,
  );
}
