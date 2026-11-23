// Steps that only show up as lines in the conversation: lookups, a mode switch and a notice.
import { type Handler, send, type TurnContext } from "./turn.ts";

/** A read or search tool call that starts and completes at once, like the adapters' lookups. */
async function lookup(
  turn: TurnContext,
  call: { kind: "read" | "search"; target: string },
): Promise<void> {
  const { kind, target } = call;
  const toolCallId = `${kind}-${target}`;
  const title = `${kind === "read" ? "Read" : "Search"} ${target}`;
  await send(turn, { sessionUpdate: "tool_call", toolCallId, title, kind, status: "pending" });
  await send(turn, { sessionUpdate: "tool_call_update", toolCallId, status: "completed" });
}

const readFile: Handler<"readFile"> = async (step, turn) => {
  await lookup(turn, { kind: "read", target: step.path });
  return undefined;
};

const searchFor: Handler<"searchFor"> = async (step, turn) => {
  await lookup(turn, { kind: "search", target: step.query });
  return undefined;
};

const changeMode: Handler<"changeMode"> = async (step, turn) => {
  await send(turn, { sessionUpdate: "current_mode_update", currentModeId: step.modeId });
  return undefined;
};

const showNotice: Handler<"showNotice"> = async (step, turn) => {
  const { title, description } = step;
  // `notice` is an update the adapters send that the ACP typings do not list.
  await send(turn, { sessionUpdate: "notice", severity: "info", title, description } as never);
  return undefined;
};

export const streamSteps = { readFile, searchFor, changeMode, showNotice };
