import type { SessionEvent } from "@agentcontrol/protocol";
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
  });
}

export function reducePermissionAnswered(state: ViewState, { payload }: Answered): void {
  const item = findPermission(state, payload.requestId);
  if (!item) return;
  const chosen = "optionId" in payload ? payload.optionId : undefined;
  item.answer = item.options.find((o) => o.optionId === chosen)?.name ?? "Cancelled";
}
