import { pageEventually, quote } from "./browser-expectations.ts";
import type { Session } from "../setup/app.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

/** The agent of the session has been handed this message: its history has a `prompt-sent` for it. */
export function expectAgentToHaveBeenSent(
  app: AppInBrowser,
  call: { session: Session; text: string },
): Promise<void> {
  return pageEventually(`expected the agent to have been sent ${quote(call.text)}`, async () => {
    const events = await app.sdk.sessions.events(call.session.id, { after: 0, limit: 1000 });
    const sent = events.some((e) => e.kind === "prompt-sent" && e.payload.text === call.text);
    return sent ? undefined : "its history has no such message";
  });
}

/** The queue above the message box holds exactly these messages, oldest first. */
export function expectQueueToHold(app: AppInBrowser, ...texts: string[]): Promise<void> {
  return pageEventually(
    `expected the queue to hold ${texts.map(quote).join(", ") || "nothing"}`,
    async () => {
      const held = await app.page.queuedMessages();
      return held.join("\u0000") === texts.join("\u0000")
        ? undefined
        : `it holds ${held.map(quote).join(", ") || "nothing"}`;
    },
  );
}

/** The queue's note says this. */
export function expectQueueNoteToSay(app: AppInBrowser, text: string): Promise<void> {
  return pageEventually(`expected the queue to say ${quote(text)}`, async () => {
    const note = await app.page.queueNote();
    return note.includes(text) ? undefined : `it says ${quote(note)}`;
  });
}

/** The page does not say a message was left unsent. */
export function expectNoUnsentWarning(app: AppInBrowser): Promise<void> {
  return pageEventually("expected no warning that a message was not sent", async () => {
    const shown = await app.page.bodyText();
    return shown.includes("Not sent:") ? "the page says a message was not sent" : undefined;
  });
}

/** The open session's turn runs: the page offers Cancel. */
export function expectAgentToBeBusy(app: AppInBrowser): Promise<void> {
  return pageEventually("expected the agent to be busy (Cancel offered)", async () => {
    return (await app.page.offersCancel()) ? undefined : "the page does not offer Cancel";
  });
}

/** The conversation shows these texts, one after the other in this order. */
export function expectConversationToShowInOrder(app: AppInBrowser, ...texts: string[]) {
  return pageEventually(
    `expected the conversation to show ${texts.map(quote).join(" then ")}`,
    async () => {
      const stream = await app.page.streamText();
      const places = texts.map((text) => stream.indexOf(text));
      const inOrder = places.every((at, i) => at >= 0 && at > (places[i - 1] ?? -1));
      return inOrder ? undefined : `it reads ${quote(stream)}`;
    },
  );
}
