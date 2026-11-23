import type { SessionEvent } from "@agentcontrol/protocol";

export type PermissionFacts = {
  permissionsRequested: number;
  permissionsAllowed: number;
  permissionsDenied: number;
};

type Kinds = Map<string, Map<string, string>>;

/** The kind ("allow_once", "reject_once", ...) of each option offered with each request. */
function offeredKinds(events: SessionEvent[]): Kinds {
  const kinds: Kinds = new Map();
  for (const event of events) {
    if (event.kind !== "permission-requested") continue;
    const { requestId, options } = event.payload;
    kinds.set(requestId, new Map(options.map((option) => [option.optionId, option.kind])));
  }
  return kinds;
}

const verdictOfKind = (kind: string | undefined): "allowed" | "denied" | undefined => {
  if (kind?.startsWith("allow")) return "allowed";
  return kind?.startsWith("reject") ? "denied" : undefined;
};

/** "allowed" or "denied" for an answer; a cancelled request is denied, an unknown option is neither. */
function verdictOf(call: { event: SessionEvent; kinds: Kinds }): "allowed" | "denied" | undefined {
  const { event, kinds } = call;
  if (event.kind !== "permission-answered") return undefined;
  if ("cancelled" in event.payload) return "denied";
  return verdictOfKind(kinds.get(event.payload.requestId)?.get(event.payload.optionId));
}

/** How many permission requests the agent made and how the user answered them. */
export function permissionsOfEvents(events: SessionEvent[]): PermissionFacts {
  const kinds = offeredKinds(events);
  const verdicts = events.map((event) => verdictOf({ event, kinds }));
  return {
    permissionsRequested: events.filter((event) => event.kind === "permission-requested").length,
    permissionsAllowed: verdicts.filter((verdict) => verdict === "allowed").length,
    permissionsDenied: verdicts.filter((verdict) => verdict === "denied").length,
  };
}
