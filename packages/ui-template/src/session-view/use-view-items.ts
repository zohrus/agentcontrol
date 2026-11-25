import type { SessionEvent } from "@agentcontrol/protocol";
import { useMemo } from "react";
import type { OutgoingView } from "./outgoing-items.ts";
import type { ViewItem } from "./view-items.ts";
import { createViewModel } from "./view-model.ts";

/** The stream's items; each render folds only the events added since the one before. */
export function useViewItems(
  events: readonly SessionEvent[],
  outgoing: readonly OutgoingView[],
): ViewItem[] {
  const model = useMemo(createViewModel, []);
  return useMemo(() => model.items(events, outgoing), [model, events, outgoing]);
}
