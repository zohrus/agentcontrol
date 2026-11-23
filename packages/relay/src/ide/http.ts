import { type IdeHeaders, type IdeRequestParams, RelayName as N } from "@agentcontrol/protocol";
import type { Client } from "../rpc/index.ts";
import type { Window } from "./window.ts";

/** Headers that describe one hop of a connection, not the message: never passed on either way. */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
]);

/** The response's headers without the ones that belong to this hop; `content-length` is set again by the app. */
export function passableHeaders(headers: Headers): IdeHeaders {
  return [...headers.entries()].filter(([name]) => !HOP_BY_HOP.has(name.toLowerCase()));
}

/** Sends the request to code-server's socket; the answer is not decoded, so compressed bytes stay as they are. */
export function requestUpstream(call: {
  socketPath: string;
  request: IdeRequestParams;
  signal: AbortSignal;
}): Promise<Response> {
  const { request, socketPath, signal } = call;
  const headers = request.headers.filter(([name]) => !HOP_BY_HOP.has(name.toLowerCase()));
  const body = request.body === undefined ? null : Buffer.from(request.body, "base64");
  const init = {
    method: request.method,
    headers,
    body,
    signal,
    redirect: "manual",
    unix: socketPath,
    decompress: false,
  };
  return fetch(`http://localhost${request.path}`, init as RequestInit);
}

async function* chunksOf(response: Response): AsyncGenerator<Uint8Array> {
  const reader = response.body?.getReader();
  if (reader === undefined) return;
  for (;;) {
    const next = (await reader.read()) as { done: boolean; value: Uint8Array };
    if (next.done) return;
    yield next.value;
  }
}

/**
 * Passes the response body on as notifications, never faster than the app acknowledges (the
 * window), so a big download never piles up in the relay or the app. Ends with `relay/ide.end`.
 */
export async function pumpBody(call: {
  response: Response;
  tunnelId: string;
  window: Window;
  client: Client;
}): Promise<void> {
  const { response, tunnelId, window, client } = call;
  try {
    for await (const chunk of chunksOf(response)) {
      await window.take(chunk.length);
      client.notify(N.ideBody, { tunnelId, data: Buffer.from(chunk).toString("base64") });
    }
    client.notify(N.ideEnd, { tunnelId });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    client.notify(N.ideEnd, { tunnelId, error: reason });
  }
}
