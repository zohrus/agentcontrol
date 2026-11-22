/** Standard JSON-RPC error codes plus the relay's own (in the -32000 server range). */
export const ErrorCode = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
  sessionNotFound: -32001,
  uncommittedChanges: -32002,
  staleFile: -32003,
  setupFailed: -32004,
  /** A file does not exist at the asked version (new, deleted, or not yet committed). */
  fileNotFound: -32005,
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
