import type {
  AgentUpdate,
  PendingPermissionRequest,
  SessionEvent,
  SessionId,
  SessionRow,
} from "../../packages/sdk/src/index.ts";
import type { Run } from "./scenario.ts";
import { expectThat } from "./wait.ts";
import type { World } from "./world.ts";

type Acp = Extract<SessionEvent, { kind: "acp" }>;

const isAcp = (event: SessionEvent): event is Acp => event.kind === "acp";

/** Every normalised update of the session, in order. */
export function updatesOf(events: SessionEvent[]): AgentUpdate[] {
  return events.filter(isAcp).flatMap((event) => event.payload.updates ?? []);
}

/** The agent's own names of the updates the relay did not interpret, one entry per update. */
export function otherNames(events: SessionEvent[]): string[] {
  return updatesOf(events).flatMap((update) => (update.type === "other" ? [update.name] : []));
}

/** `{ name: count }` as one line, e.g. "available_commands_update x2, session_info_update x1". */
export function describeCounts(names: string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  const parts = [...counts].map(([name, count]) => `${name} x${String(count)}`);
  return parts.length === 0 ? "none" : parts.join(", ");
}

/** Waits until the session asks for permission, and returns its row. */
export function waitsForApproval(world: World, id: SessionId): Promise<SessionRow> {
  return world.waitsForSession({
    id,
    describe: "the session to wait for approval",
    when: (row) => row.pendingPermissions.length > 0 || row.status === "failed",
  });
}

/** Waits until the agent ended its turn and the session waits for the user's next message. */
export function waitsForReply(world: World, id: SessionId): Promise<SessionRow> {
  return world.waitsForSession({
    id,
    describe: "the session to wait for a reply",
    when: (row) => row.waitingReason === "reply" || row.status === "failed",
  });
}

/** Answers the first pending request with the option of this kind. */
export async function answersWith(
  world: World,
  options: { id: SessionId; row: SessionRow; kind: string },
): Promise<void> {
  const request = options.row.pendingPermissions[0];
  expectThat(request !== undefined, "expected a pending permission request to answer");
  const option = request.options.find((candidate) => candidate.kind === options.kind);
  expectThat(option !== undefined, `expected the request to offer a "${options.kind}" option`);
  await world.app.sdk.sessions.answerPermission(options.id, request.requestId, option.optionId);
}

/** Texts the agent wrote, whole messages joined from their chunks. */
export function agentTextOf(events: SessionEvent[]): string {
  return updatesOf(events)
    .flatMap((update) => (update.type === "agent-text" ? [update.text] : []))
    .join("");
}

export function countKind(events: SessionEvent[], kind: SessionEvent["kind"]): number {
  return events.filter((event) => event.kind === kind).length;
}

/** The request the session waits on first; fails when there is none. */
export function requestOf(row: SessionRow): PendingPermissionRequest {
  const request = row.pendingPermissions[0];
  expectThat(request !== undefined, `expected session "${row.title}" to have a pending request`);
  return request;
}

/** One line about the first pending request: its title, kind, command and the options it offers. */
export function describeRequest(row: SessionRow): string {
  const { toolCall, options } = requestOf(row);
  const parts = [toolCall.kind, toolCall.command, toolCall.path].filter(
    (part) => part !== undefined,
  );
  return `asked: "${toolCall.title}" (${parts.join(", ")}); options ${options.map((option) => option.kind).join("/")}`;
}

/** The session scenario a built, which the flow scenarios after it build on. */
export function flowSessionOf(run: Run): SessionId {
  const id = run.flow.sessionId;
  expectThat(id !== undefined, "this scenario needs scenario a, which did not start a session");
  return id;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
