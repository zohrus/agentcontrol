import type { SessionEvent } from "@agentcontrol/protocol";
import { itemKey, type ViewState } from "./view-state.ts";

type Output = Extract<SessionEvent, { kind: "setup-output" }>;
type Finished = Extract<SessionEvent, { kind: "setup-finished" }>;

function setupItem(state: ViewState, key: string) {
  const last = state.items.at(-1);
  if (last?.type === "setup") return last;
  const item = { type: "setup" as const, key, text: "", exitCode: undefined };
  state.items.push(item);
  return item;
}

/** Setup output chunks merge into one block. */
export function reduceSetupOutput(state: ViewState, event: Output): void {
  setupItem(state, itemKey("setup", event.seq)).text += event.payload.text;
}

export function reduceSetupFinished(state: ViewState, event: Finished): void {
  setupItem(state, itemKey("setup", event.seq)).exitCode = event.payload.exitCode;
}
