import {
  type AgentContext,
  methods,
  type RequestPermissionRequest,
  type SessionUpdate,
} from "@agentclientprotocol/sdk";
import type { Step, StopReason } from "./script.ts";

export interface TurnContext {
  readonly client: AgentContext;
  readonly sessionId: string;
  /** The agent's working directory, from session/new; edits are written below it. */
  readonly cwd: string;
  /** Resolves when the client sends session/cancel (also if it did so before the turn began). */
  readonly cancelled: Promise<void>;
  /** The `_meta` the client sent with session/new: launch-time settings for the adapter. */
  readonly launchSettings: unknown;
}

/** A handler returns a stop reason to end the turn early, or nothing to carry on. */
export type Handler<K extends Step["kind"]> = (
  step: Extract<Step, { kind: K }>,
  turn: TurnContext,
) => Promise<StopReason | undefined>;

export async function send(turn: TurnContext, update: SessionUpdate): Promise<void> {
  await turn.client.notify(methods.client.session.update, { sessionId: turn.sessionId, update });
}

export const ALLOW_OR_REJECT: RequestPermissionRequest["options"] = [
  { optionId: "allow", name: "Allow", kind: "allow_once" },
  { optionId: "reject", name: "Reject", kind: "reject_once" },
];
