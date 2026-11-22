import type { SessionUpdate } from "@agentclientprotocol/sdk";
import type { Conversation } from "../setup/conversation.ts";
import type { TimelineEntry } from "../setup/timeline.ts";

function textOf(update: SessionUpdate): string {
  if (update.sessionUpdate !== "agent_message_chunk") return "";
  return update.content.type === "text" ? update.content.text : "";
}

function isAgentReply(entry: TimelineEntry, text: string): boolean {
  return entry.kind === "update" && textOf(entry.update).includes(text);
}

function isRequestToRun(entry: TimelineEntry, command: string): boolean {
  return entry.kind === "permission" && entry.request.toolCall.title === `Run ${command}`;
}

export async function expectAgentToAskPermissionToRun(
  conversation: Conversation,
  command: string,
): Promise<void> {
  await conversation.timeline.waitFor(
    (entry) => isRequestToRun(entry, command),
    `expected the agent to ask permission to run \`${command}\``,
  );
}

export async function expectAgentReply(conversation: Conversation, text: string): Promise<void> {
  await conversation.timeline.waitFor(
    (entry) => isAgentReply(entry, text),
    `expected the agent to reply "${text}"`,
  );
}

export async function expectAgentToEditFile(
  conversation: Conversation,
  path: string,
): Promise<void> {
  await conversation.timeline.waitFor(
    (entry) =>
      entry.kind === "update" &&
      entry.update.sessionUpdate === "tool_call" &&
      entry.update.title === `Edit ${path}`,
    `expected the agent to edit ${path}`,
  );
}

export function expectTurnToEndWith(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(
      `expected the agent to finish its turn with "${expected}", but it finished with "${actual}"`,
    );
  }
}

export function expectAgentNotToHaveReplied(conversation: Conversation, text: string): void {
  const replied = conversation.timeline.entries.some((entry) => isAgentReply(entry, text));
  if (replied) throw new Error(`expected the agent not to reply "${text}", but it did`);
}
