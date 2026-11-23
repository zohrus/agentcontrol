import { RelayName, type SessionEvent } from "@agentcontrol/protocol";
import type { AgentUpdate } from "@agentcontrol/sdk";
import type { AppAccess } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";
import type { RelayAccess, Session } from "../setup/relay.ts";
import { allUpdates } from "../setup/updates.ts";

/** Where a test reads a session's events from: the relay's stream or the app's history. */
export type EventSource = () => Promise<SessionEvent[]>;

type Kind<T extends AgentUpdate["type"]> = Extract<AgentUpdate, { type: T }>;

/** The events the relay has streamed to the app's connection so far. */
export const eventsStreamedByRelay =
  (relay: RelayAccess, session: Session): EventSource =>
  () =>
    Promise.resolve(relay.events.entries.filter((event) => event.sessionId === session.id));

/** The events the app's live stream has delivered to the UI so far. */
export const eventsStreamedToApp =
  (app: AppAccess, session: Session): EventSource =>
  () =>
    Promise.resolve(app.streamed.entries.filter((event) => event.sessionId === session.id));

/** The session's whole history, read through the SDK like the UI does. */
export const eventsReadThroughSdk =
  (app: AppAccess, session: Session): EventSource =>
  () =>
    app.sdk.sessions.events(session.id);

export async function expectUpdate(
  source: EventSource,
  want: { describe: string; matches: (update: AgentUpdate) => boolean },
): Promise<void> {
  await eventually(`expected ${want.describe}`, async () => {
    const updates = allUpdates(await source());
    if (updates.some(want.matches)) return undefined;
    return `it arrived as: ${updates.map((update) => update.type).join(", ") || "no updates"}`;
  });
}

/** The agent's reply arrived as an `agent-text` update with this text. */
export function expectReplyAsUpdate(source: EventSource, text: string): Promise<void> {
  return expectUpdate(source, {
    describe: `the agent's reply "${text}" as a normalised update`,
    matches: (update) => update.type === "agent-text" && update.text === text,
  });
}

/** The agent's reasoning arrived as an `agent-thought` update with this text. */
export function expectThoughtAsUpdate(source: EventSource, text: string): Promise<void> {
  return expectUpdate(source, {
    describe: `the agent's thought "${text}" as a normalised update`,
    matches: (update) => update.type === "agent-thought" && update.text === text,
  });
}

/** The user's message arrived as a `user-text` update with this text. */
export function expectUserMessageAsUpdate(source: EventSource, text: string): Promise<void> {
  return expectUpdate(source, {
    describe: `the user's message "${text}" as a normalised update`,
    matches: (update) => update.type === "user-text" && update.text === text,
  });
}

/** The agent's plan arrived as a `plan` update listing exactly these tasks, all pending. */
export function expectPlanAsUpdate(source: EventSource, tasks: string[]): Promise<void> {
  const wanted = JSON.stringify(tasks.map((content) => ({ content, status: "pending" })));
  return expectUpdate(source, {
    describe: `the plan ${JSON.stringify(tasks)} as a normalised update`,
    matches: (update) => update.type === "plan" && JSON.stringify(update.entries) === wanted,
  });
}

/** A file edit arrived as an `edit` tool update that carries the file's before and after text. */
export function expectFileEditAsUpdate(
  source: EventSource,
  edit: { path: string; oldText: string; newText: string },
): Promise<void> {
  const wanted = JSON.stringify([edit]);
  const isTheEdit = (update: AgentUpdate): update is Kind<"tool-started"> =>
    update.type === "tool-started" && update.kind === "edit";
  return expectUpdate(source, {
    describe: `an edit of ${edit.path} with its diff as a normalised update`,
    matches: (update) => isTheEdit(update) && JSON.stringify(update.files) === wanted,
  });
}

/** The tool call reached this status in a `tool-updated` update. */
export function expectToolToReach(source: EventSource, status: string): Promise<void> {
  return expectUpdate(source, {
    describe: `a tool call to reach "${status}" as a normalised update`,
    matches: (update) => update.type === "tool-updated" && update.status === status,
  });
}

/** The finished turn arrived as `turn-ended` with this stop reason. */
export function expectTurnEndedAsUpdate(source: EventSource, stopReason: string): Promise<void> {
  return expectUpdate(source, {
    describe: `the turn to end with "${stopReason}" as a normalised update`,
    matches: (update) => update.type === "turn-ended" && update.stopReason === stopReason,
  });
}

/** An update kind the relay does not interpret arrived as `other`, named as the agent named it. */
export function expectUninterpretedUpdate(source: EventSource, name: string): Promise<void> {
  return expectUpdate(source, {
    describe: `the agent's "${name}" message as an \`other\` update`,
    matches: (update) => update.type === "other" && update.name === name,
  });
}

/** The permission request names the tool call it concerns, described like a tool update. */
export async function expectPermissionRequestDescribed(
  source: EventSource,
  tool: { title: string; kind: string; command?: string },
): Promise<void> {
  await eventually(`expected the permission request to describe "${tool.title}"`, async () => {
    const request = (await source()).find((event) => event.kind === "permission-requested");
    if (request?.kind !== "permission-requested") return "there is no permission request";
    const { title, kind, command } = request.payload.tool ?? {};
    const seen = JSON.stringify({ title, kind, command });
    return seen === JSON.stringify(tool) ? undefined : `it describes ${seen}`;
  });
}

/** The relay's usage for the session comes from normalised updates: one row with these tokens. */
export async function expectUsageFromUpdates(
  relay: RelayAccess,
  call: { session: Session; inputTokens: number; costUsd: number; model: string },
): Promise<void> {
  const { rows } = await relay.call(RelayName.usage, { sessionId: call.session.id });
  const [row] = rows;
  const pick = (r: typeof row) => ({
    n: rows.length,
    inputTokens: r?.inputTokens,
    costUsd: r?.costUsd,
    model: r?.model,
  });
  const wanted = { n: 1, inputTokens: call.inputTokens, costUsd: call.costUsd, model: call.model };
  if (JSON.stringify(pick(row)) !== JSON.stringify(wanted)) {
    const seen = JSON.stringify(pick(row));
    throw new Error(`expected usage ${JSON.stringify(wanted)} from the updates, but got ${seen}`);
  }
}
