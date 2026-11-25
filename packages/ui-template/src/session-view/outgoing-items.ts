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

type Outgoing = ItemOf<"outgoing">;

/**
 * What the stream remembers between renders so that a sent message keeps its place and element
 * when the history takes it over: the messages on the way, those that left the list in the last
 * update and have not been matched to the history's copy yet, the history's messages already seen,
 * and the takeovers.
 */
export type SentMemory = {
  onTheWay: Map<string, Outgoing>;
  taken: readonly Outgoing[];
  seen: Set<string>;
  takenOver: Map<string, Outgoing>;
};

export const newSentMemory = (): SentMemory => ({
  onTheWay: new Map(),
  taken: [],
  seen: new Set(),
  takenOver: new Map(),
});

/** The history's copy of a sent message, drawn as the sent message it replaces: same key, same element. */
function takeOver(memory: SentMemory, item: ItemOf<"user">): ViewItem {
  const done = memory.takenOver.get(item.key);
  if (done) return done;
  if (memory.seen.has(item.key)) return item;
  const sent = memory.taken.find((candidate) => candidate.text === item.text);
  if (!sent) return item;
  memory.taken = memory.taken.filter((candidate) => candidate !== sent);
  const copy: Outgoing = { ...sent, text: item.text, state: "sent", error: undefined };
  memory.takenOver.set(item.key, copy);
  return copy;
}

/** The messages that were on the way and are no longer listed: the history has them, or they were given up on. */
function departed(items: readonly ViewItem[], memory: SentMemory): Outgoing[] {
  const keys = new Set(items.map((item) => item.key));
  return [...memory.onTheWay].filter(([key]) => !keys.has(key)).map(([, sent]) => sent);
}

/**
 * Notes which messages left the list this time (not those the user gave up on) and which are on
 * the way now. The history's copy arrives in the same update, so only these can be matched.
 */
function noteDeparted(items: readonly ViewItem[], memory: SentMemory): void {
  memory.taken = departed(items, memory).filter((sent) => sent.state !== "failed");
  memory.onTheWay.clear();
  for (const item of items) {
    if (item.type === "outgoing") memory.onTheWay.set(item.key, item);
  }
}

/**
 * The history's copy of a message the user sent takes over the sent message's key, so the stream
 * keeps the same element (and the same height) instead of drawing a new one in its place.
 */
export function keepSentMessages(items: ViewItem[], memory: SentMemory): ViewItem[] {
  noteDeparted(items, memory);
  const kept = items.map((item) => (item.type === "user" ? takeOver(memory, item) : item));
  for (const item of items) {
    if (item.type === "user") memory.seen.add(item.key);
  }
  return kept;
}
