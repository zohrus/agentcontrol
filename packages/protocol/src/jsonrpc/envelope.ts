import { z } from "zod";

/** A JSON-RPC request id. */
export const JsonRpcId = z.union([z.string(), z.number(), z.null()]);
export type JsonRpcId = z.infer<typeof JsonRpcId>;

const version = z.literal("2.0");

/** A JSON-RPC 2.0 request: a call that expects a response. */
export const JsonRpcRequest = z.object({
  jsonrpc: version,
  id: JsonRpcId,
  method: z.string(),
  params: z.unknown().optional(),
});
export type JsonRpcRequest = z.infer<typeof JsonRpcRequest>;

/** A JSON-RPC 2.0 notification: a call with no id and no response. */
export const JsonRpcNotification = z.object({
  jsonrpc: version,
  method: z.string(),
  params: z.unknown().optional(),
});
export type JsonRpcNotification = z.infer<typeof JsonRpcNotification>;

/** A JSON-RPC 2.0 success response. */
export const JsonRpcSuccess = z.object({
  jsonrpc: version,
  id: JsonRpcId,
  result: z.unknown(),
});
export type JsonRpcSuccess = z.infer<typeof JsonRpcSuccess>;

/** The error object inside a JSON-RPC error response. */
export const JsonRpcErrorBody = z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});
export type JsonRpcErrorBody = z.infer<typeof JsonRpcErrorBody>;

/** A JSON-RPC 2.0 error response. */
export const JsonRpcFailure = z.object({
  jsonrpc: version,
  id: JsonRpcId,
  error: JsonRpcErrorBody,
});
export type JsonRpcFailure = z.infer<typeof JsonRpcFailure>;

/** Any JSON-RPC 2.0 message that can appear on a relay line. */
export const JsonRpcMessage = z.union([
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcSuccess,
  JsonRpcFailure,
]);
export type JsonRpcMessage = z.infer<typeof JsonRpcMessage>;
