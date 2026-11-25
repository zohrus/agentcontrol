import type { SessionEvent } from "@agentcontrol/protocol";
import { emptyFold, extendsFold, flagStreaming, foldNew } from "./fold-events.ts";
import { groupTools } from "./group-tools.ts";
import { type OutgoingView, withOutgoing } from "./outgoing-items.ts";
import { byKey, type Known, publish, stabilise } from "./stable-items.ts";
import type { ViewItem } from "./view-items.ts";

/** Builds the stream's items from the history, taking in only what is new since the last call. */
export type ViewModel = {
  items: (events: readonly SessionEvent[], outgoing: readonly OutgoingView[]) => ViewItem[];
};

/**
 * Folds only the events added since the last call onto the previous result. When the history is
 * not that plus newer events (a session switch, events replaced after a renormalise) it folds
 * all of it again. Either way an item that shows the same as before is the same object.
 */
export function createViewModel(): ViewModel {
  let fold = emptyFold();
  let working: Known = new Map();
  let shown: Known = new Map();
  return {
    items: (events, outgoing) => {
      if (!extendsFold(fold, events)) fold = emptyFold();
      foldNew(fold, events);
      flagStreaming(fold);
      const published = publish(working, fold.state.items);
      working = byKey(published);
      const items = stabilise(shown, withOutgoing(groupTools(published), outgoing));
      shown = byKey(items);
      return items;
    },
  };
}

/** The items for a history in one go: no memory of an earlier call. */
export function buildViewItems(events: readonly SessionEvent[]): ViewItem[] {
  return createViewModel().items(events, []);
}
