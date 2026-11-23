import { ErrorCode, type JsonRpcErrorBody } from "@agentcontrol/protocol";

/** A failure the app should see as a specific JSON-RPC error code. */
export class RelayError extends Error {
  readonly code: ErrorCode;
  readonly data: unknown;

  constructor(code: ErrorCode, message: string, data?: unknown) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

/** Turns anything a handler threw into the error body sent back to the client. */
export function toErrorBody(error: unknown): JsonRpcErrorBody {
  if (error instanceof RelayError) {
    return { code: error.code, message: error.message, data: error.data };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { code: ErrorCode.internalError, message };
}
