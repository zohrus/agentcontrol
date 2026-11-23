import { TOKEN_PROTOCOL_PREFIX } from "@agentcontrol/protocol";

const asksToUpgrade = (request: { method: string; headers: Headers }): boolean =>
  request.method === "GET" && request.headers.get("upgrade")?.toLowerCase() === "websocket";

/**
 * The secret a browser sends with a WebSocket upgrade. A browser cannot set headers on a
 * WebSocket, so the client offers the secret as a subprotocol (`agentcontrol.token.<secret>`).
 * Only a GET that asks to upgrade counts: nothing else may carry the secret this way, and it never
 * travels in the address, where it would be logged and kept in history.
 */
export function socketTokenOf(request: { method: string; headers: Headers }): string | undefined {
  if (!asksToUpgrade(request)) return undefined;
  const offered = (request.headers.get("sec-websocket-protocol") ?? "")
    .split(",")
    .map((name) => name.trim());
  const named = offered.find((name) => name.startsWith(TOKEN_PROTOCOL_PREFIX));
  return named?.slice(TOKEN_PROTOCOL_PREFIX.length);
}
