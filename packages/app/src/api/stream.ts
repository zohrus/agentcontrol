import { Hono } from "hono";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";
import type { Hub, HubMessage } from "../sync/index.ts";
import type { ApiDeps } from "./deps.ts";

/**
 * One SSE message: its name and its JSON data. Every message that concerns a session names the
 * workspace: `event` is the session event plus `workspaceId`, `sessions` is a list of session rows
 * (each with its `workspaceId`), `fs` is `{ workspaceId, sessionId, paths }`.
 */
function sseOf(message: HubMessage): { event: string; data: string } {
  const { type } = message;
  switch (message.type) {
    case "event":
      return {
        event: type,
        data: JSON.stringify({ ...message.event, workspaceId: message.workspaceId }),
      };
    case "sessions":
      return { event: type, data: JSON.stringify(message.sessions) };
    case "fs":
      return {
        event: type,
        data: JSON.stringify({
          workspaceId: message.workspaceId,
          sessionId: message.sessionId,
          paths: message.paths,
        }),
      };
  }
}

async function follow(hub: Hub, stream: SSEStreamingApi): Promise<void> {
  const stop = hub.subscribe((message) => void stream.writeSSE(sseOf(message)));
  await stream.writeSSE({ event: "ready", data: "{}" });
  await new Promise<void>((resolve) => {
    stream.onAbort(resolve);
  });
  stop();
}

/** The live stream: `event`, `sessions` and `fs` messages, after an initial `ready`. */
export function streamRoute({ hub }: ApiDeps) {
  return new Hono().get("/stream", (c) => streamSSE(c, (stream) => follow(hub, stream)));
}
