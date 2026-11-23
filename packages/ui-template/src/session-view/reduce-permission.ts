import type { PermissionOption, SessionEvent } from "@agentcontrol/protocol";
import type { ItemOf } from "./view-items.ts";
import { findPermission, itemKey, type ViewState } from "./view-state.ts";

type Requested = Extract<SessionEvent, { kind: "permission-requested" }>;
type Answered = Extract<SessionEvent, { kind: "permission-answered" }>;

export function reducePermissionRequested(state: ViewState, { payload }: Requested): void {
  state.items.push({
    type: "permission",
    key: itemKey("permission", payload.requestId),
    requestId: payload.requestId,
    title: payload.tool?.title ?? "The agent asks for permission",
    options: payload.options,
    answer: undefined,
    automatic: undefined,
  });
}

const chosenOption = (item: ItemOf<"permission">, payload: Answered["payload"]) =>
  "optionId" in payload ? item.options.find((o) => o.optionId === payload.optionId) : undefined;

function automaticAnswer(payload: Answered["payload"], option: PermissionOption | undefined) {
  if (!payload.automatic) return undefined;
  return { reason: payload.automatic.reason, refused: !option?.kind.startsWith("allow") };
}

export function reducePermissionAnswered(state: ViewState, { payload }: Answered): void {
  const item = findPermission(state, payload.requestId);
  if (!item) return;
  const option = chosenOption(item, payload);
  item.answer = option?.name ?? "Cancelled";
  item.automatic = automaticAnswer(payload, option);
}
