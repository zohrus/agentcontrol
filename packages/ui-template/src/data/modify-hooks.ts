import type { ModifyState, SessionEvent, UiVersionEntry } from "@agentcontrol/sdk";
import { useSessionEvents, useData } from "./hooks.ts";
import { type ModifyAction, modifySession } from "./modify-data.ts";
import { busyKey } from "./pending.ts";
import { useController } from "./provider.tsx";

const nothingYet: ModifyState = { status: "idle", gate: "idle", changedFiles: [] };

/** Everything the Modify panel shows and can do, kept current by the live stream. */
export type ModifyData = {
  state: ModifyState;
  versions: readonly UiVersionEntry[];
  /** The Modify agent's conversation, as session events. */
  events: readonly SessionEvent[];
  /** The request the user just sent that the app has not taken yet, when there is one. */
  sending: string | undefined;
  /** The other action (Keep, Undo, ...) that was pressed and is not answered yet, when there is one. */
  pressed: Exclude<ModifyAction, "request"> | undefined;
  actions: ReturnType<typeof useController>["modify"];
};

/** The Modify agent's state, the UI's saved versions, its conversation, and what the user can do. */
export function useModify(): ModifyData {
  const state = useData((s) => s.modify) ?? nothingYet;
  const versions = useData((s) => s.versions);
  const { sessionId } = state;
  const events = useSessionEvents(sessionId === undefined ? undefined : modifySession(sessionId));
  const busy = useData((s) => s.pending.busy);
  const sending = busy[busyKey("modify", "request")];
  const others = ["keep", "undo", "discard", "restore", "update"] as const;
  const pressed = others.find((name) => busy[busyKey("modify", name)] !== undefined);
  return { state, versions, events, sending, pressed, actions: useController().modify };
}
