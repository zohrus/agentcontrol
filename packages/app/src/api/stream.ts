import { Hono } from "hono";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";
import type { Hub, HubMessage } from "../sync/index.ts";
import type { ApiDeps } from "./deps.ts";

type Of<T extends HubMessage["type"]> = Extract<HubMessage, { type: T }>;

/** What each kind of hub message sends as its SSE data. */
const dataOf: { [T in HubMessage["type"]]: (message: Of<T>) => unknown } = {
  event: (message) => ({ ...message.event, workspaceId: message.workspaceId }),
  sessions: (message) => message.sessions.filter((session) => session.kind !== "directory"),
  fs: ({ workspaceId, sessionId, paths }) => ({ workspaceId, sessionId, paths }),
  workspace: (message) => message.workspace,
  modify: (message) => message.state,
};

/**
 * One SSE message: its name and its JSON data. Every message that concerns a session names the
 * workspace: `event` is the session event plus `workspaceId`, `sessions` is a list of session rows
 * (each with its `workspaceId`), `fs` is `{ workspaceId, sessionId, paths }`, `workspace` is a
 * workspace record whose connection `state` changed.
 */
function sseOf(message: HubMessage): { event: string; data: string } {
  const toData = dataOf[message.type] as (message: HubMessage) => unknown;
  return { event: message.type, data: JSON.stringify(toData(message)) };
}

async function follow(hub: Hub, stream: SSEStreamingApi): Promise<void> {
  const stop = hub.subscribe((message) => void stream.writeSSE(sseOf(message)));
  await stream.writeSSE({ event: "ready", data: "{}" });
  await new Promise<void>((resolve) => {
    stream.onAbort(resolve);
  });
  stop();
}

/**
 * The live stream: `event`, `sessions`, `fs`, `workspace` and `modify` messages, after an initial
 * `ready`.
 */
export function streamRoute({ hub }: ApiDeps) {
  return new Hono().get("/stream", (c) => streamSSE(c, (stream) => follow(hub, stream)));
}
