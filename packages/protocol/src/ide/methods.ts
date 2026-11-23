import { z } from "zod";
import { SessionId } from "../ids/index.ts";

/** Identifies one tunnelled HTTP request or WebSocket; the app makes it up, one per connection. */
export const IdeTunnelId = z.string().min(1);
export type IdeTunnelId = z.infer<typeof IdeTunnelId>;

/** HTTP headers as pairs, in order, so a repeated header (`set-cookie`) keeps every value. */
export const IdeHeaders = z.array(z.tuple([z.string(), z.string()]));
export type IdeHeaders = z.infer<typeof IdeHeaders>;

/** The most bytes of request body one `relay/ide.request` carries (base64 of it is a third more). */
export const IDE_MAX_REQUEST_BYTES = 16 * 1024 * 1024;
/**
 * The most bytes of a response or WebSocket message the relay sends before the app has said it
 * handed them on (`relay/ide.ack`). Bytes are never dropped: the relay waits instead.
 */
export const IDE_WINDOW_BYTES = 1024 * 1024;

/** Params of relay/ide.status. */
export const IdeStatusParams = z.object({ sessionId: SessionId });
/** Result of relay/ide.status: is code-server on the workspace's PATH, and is one running here. */
export const IdeStatusResult = z.object({
  installed: z.boolean(),
  /** The version code-server printed, for example "4.96.4". */
  version: z.string().optional(),
  running: z.boolean(),
});

/** Params of relay/ide.start: starts code-server for the session on a private socket (or reuses it). */
export const IdeStartParams = z.object({ sessionId: SessionId });
/** Params of relay/ide.stop: ends the session's code-server and every tunnel into it. */
export const IdeStopParams = z.object({ sessionId: SessionId });

/** Params of relay/ide.request: one HTTP request to the session's code-server. */
export const IdeRequestParams = z.object({
  sessionId: SessionId,
  tunnelId: IdeTunnelId,
  method: z.string().min(1),
  /** Path and query, starting with "/". */
  path: z.string().startsWith("/"),
  headers: IdeHeaders,
  /** The request body, base64. */
  body: z.string().optional(),
});
/**
 * Result of relay/ide.request: the response's status and headers. The body follows as
 * relay/ide.body notifications and one relay/ide.end.
 */
export const IdeRequestResult = z.object({ status: z.number().int(), headers: IdeHeaders });

/** Params of relay/ide.ack: the app handed `bytes` of this tunnel's data on, so the relay may send more. */
export const IdeAckParams = z.object({ tunnelId: IdeTunnelId, bytes: z.number().int().min(0) });
/** Params of relay/ide.close: ends the request or WebSocket (the browser went away). */
export const IdeCloseParams = z.object({ tunnelId: IdeTunnelId });

/** Params of relay/ide.socket.open: opens a WebSocket to the session's code-server. */
export const IdeSocketOpenParams = z.object({
  sessionId: SessionId,
  tunnelId: IdeTunnelId,
  path: z.string().startsWith("/"),
  headers: IdeHeaders,
  protocols: z.array(z.string()),
});
/** Result of relay/ide.socket.open: the subprotocol code-server chose, if any (empty when none). */
export const IdeSocketOpenResult = z.object({ protocol: z.string() });
/**
 * One message of an open WebSocket (base64; text is UTF-8), in either direction: the params of
 * relay/ide.socket.send (from the browser) and of the relay/ide.socket.message notification (from
 * code-server).
 */
export const IdeSocketMessageParams = z.object({
  tunnelId: IdeTunnelId,
  data: z.string(),
  binary: z.boolean(),
});

/** Params of the relay/ide.body notification: a piece of a response body (base64). */
export const IdeBodyParams = z.object({ tunnelId: IdeTunnelId, data: z.string() });
/** Params of the relay/ide.end notification: the response body is complete, or broke off with `error`. */
export const IdeEndParams = z.object({ tunnelId: IdeTunnelId, error: z.string().optional() });
/** Params of the relay/ide.socket.closed notification: the WebSocket to code-server ended. */
export const IdeSocketClosedParams = z.object({
  tunnelId: IdeTunnelId,
  code: z.number().int(),
  reason: z.string(),
});

export type IdeStatusResult = z.infer<typeof IdeStatusResult>;
export type IdeRequestParams = z.infer<typeof IdeRequestParams>;
export type IdeRequestResult = z.infer<typeof IdeRequestResult>;
export type IdeSocketOpenParams = z.infer<typeof IdeSocketOpenParams>;
export type IdeSocketOpenResult = z.infer<typeof IdeSocketOpenResult>;
export type IdeBodyParams = z.infer<typeof IdeBodyParams>;
export type IdeEndParams = z.infer<typeof IdeEndParams>;
export type IdeSocketClosedParams = z.infer<typeof IdeSocketClosedParams>;
