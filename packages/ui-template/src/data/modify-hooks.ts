import type { ModifyState, SessionEvent, UiVersionEntry } from "@agentcontrol/sdk";
import { useSessionEvents, useData } from "./hooks.ts";
import { useController } from "./provider.tsx";

const nothingYet: ModifyState = { status: "idle", gate: "idle", changedFiles: [] };

/** Everything the Modify panel shows and can do, kept current by the live stream. */
export type ModifyData = {
  state: ModifyState;
  versions: readonly UiVersionEntry[];
  /** The Modify agent's conversation, as session events. */
  events: readonly SessionEvent[];
  actions: ReturnType<typeof useController>["modify"];
};

/** The Modify agent's state, the UI's saved versions, its conversation, and what the user can do. */
export function useModify(): ModifyData {
  const state = useData((s) => s.modify) ?? nothingYet;
  const versions = useData((s) => s.versions);
  const events = useSessionEvents(state.sessionId);
  return { state, versions, events, actions: useController().modify };
}
