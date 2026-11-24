import type { ItemOf, ViewItem } from "./view-items.ts";

/** A message the user sent, as the conversation shows it before the history does. */
export type OutgoingView = Omit<ItemOf<"outgoing">, "type" | "key">;

/** The items, then the messages the history does not hold yet. */
export function withOutgoing(items: ViewItem[], outgoing: readonly OutgoingView[]): ViewItem[] {
  const sent = outgoing.map(
    (message): ViewItem => ({
      ...message,
      type: "outgoing",
      key: `outgoing-${message.localId}`,
    }),
  );
  return [...items, ...sent];
}
