import { client, methods, type RequestPermissionRequest } from "@agentclientprotocol/sdk";
import type { Replay } from "./handshake.ts";
import type { SpawnedAgent } from "./spawn.ts";
import { tapStream } from "./tap.ts";
import type { MessageDirection, PermissionAnswer, StartAgentOptions } from "./types.ts";

function toOutcome(answer: PermissionAnswer) {
  return "optionId" in answer
    ? { outcome: "selected" as const, optionId: answer.optionId }
    : { outcome: "cancelled" as const };
}

async function askPermission(params: RequestPermissionRequest, options: StartAgentOptions) {
  const answer = await options.onPermissionRequest({
    requestId: crypto.randomUUID(),
    toolCall: params.toolCall,
    options: params.options.map(({ optionId, name, kind }) => ({ optionId, name, kind })),
  });
  return { outcome: toOutcome(answer) };
}

const isUpdate = (message: unknown): boolean =>
  typeof message === "object" &&
  message !== null &&
  "method" in message &&
  message.method === methods.client.session.update;

/** Reports every message, except the history a loaded session replays: that was logged live once. */
function reportingTo(options: StartAgentOptions, replay: Replay) {
  return (direction: MessageDirection, message: unknown): void => {
    if (replay.active && direction === "from-agent" && isUpdate(message)) return;
    options.onMessage(direction, message);
  };
}

/** The ACP connection to the process: every message is reported, permission requests are asked of the user. */
export function connectTo(spawned: SpawnedAgent, options: StartAgentOptions) {
  const replay: Replay = { active: false };
  const { stream, drained } = tapStream(spawned.stream, reportingTo(options, replay));
  const connection = client({ name: "agentcontrol-relay" })
    .onNotification(methods.client.session.update, () => undefined)
    .onRequest(methods.client.session.requestPermission, ({ params }) =>
      askPermission(params, options),
    )
    .connect(stream);
  return { connection, drained, replay };
}

export type Connection = ReturnType<typeof connectTo>["connection"];
