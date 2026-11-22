import {
  type ClientConnection,
  type PermissionOption,
  type PermissionOptionKind,
  type RequestPermissionResponse,
  type StopReason,
} from "@agentclientprotocol/sdk";
import { methods } from "@agentclientprotocol/sdk";
import { onTestEnd } from "./cleanup.ts";
import type { Timeline } from "./timeline.ts";

export interface Conversation {
  readonly timeline: Timeline;
  userSends(text: string): Promise<StopReason>;
  userAllowsTheCommand(): void;
  userRejectsTheCommand(): void;
}

export type Choice = PermissionOptionKind | "cancelled";
export type Decide = (choice: Choice) => void;

export function outcomeFor(
  options: readonly PermissionOption[],
  kind: Choice,
): RequestPermissionResponse {
  if (kind === "cancelled") return { outcome: { outcome: "cancelled" } };
  const option = options.find((o) => o.kind === kind);
  if (!option) throw new Error(`the agent offered no "${kind}" option to choose`);
  return { outcome: { outcome: "selected", optionId: option.optionId } };
}

interface ConversationParts {
  readonly connection: ClientConnection;
  readonly sessionId: string;
  readonly timeline: Timeline;
  readonly pendingDecisions: Decide[];
}

function decideNext(pending: Decide[], kind: Choice): void {
  const decide = pending.shift();
  if (!decide) throw new Error("the user has no permission request waiting for an answer");
  decide(kind);
}

export function conversationOf(parts: ConversationParts): Conversation {
  const prompts: Array<Promise<unknown>> = [];
  onTestEnd(async () => {
    parts.pendingDecisions.splice(0).forEach((decide) => {
      decide("cancelled");
    });
    await Promise.allSettled(prompts);
  });
  return {
    timeline: parts.timeline,
    userSends: (text) => {
      const turn = parts.connection.agent
        .request(methods.agent.session.prompt, {
          sessionId: parts.sessionId,
          prompt: [{ type: "text", text }],
        })
        .then((response) => response.stopReason);
      prompts.push(turn);
      return turn;
    },
    userAllowsTheCommand: () => {
      decideNext(parts.pendingDecisions, "allow_once");
    },
    userRejectsTheCommand: () => {
      decideNext(parts.pendingDecisions, "reject_once");
    },
  };
}
