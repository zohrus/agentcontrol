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
  /** A config plan no longer matches the files on disk. */
  configStale: -32006,
  /** A file is bigger than the relay hands over in one answer (see `relay/fs.readBytes`). */
  fileTooLarge: -32007,
  /** The session was archived: it has no folder to open a terminal in. */
  sessionArchived: -32008,
  /** No such terminal, or it belongs to another client. */
  terminalNotFound: -32009,
  /** code-server is not on the workspace's PATH: it is the user's tool, never installed by us. */
  ideNotInstalled: -32011,
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * The `data` of an `invalidParams` answer to params that do not fit the method's schema, as
 * opposed to one the relay refused for what they ask. A client that sent what its own schema allows
 * and gets this back is talking to a relay that expects something else.
 */
export const SCHEMA_REFUSAL = { schemaRefusal: true } as const;

/** What zod's `error.message` looks like: a JSON list of issues, each with a `code` and a `path`. */
const ISSUES = /^\[\s*\{\s*"[a-z]+":[\s\S]*"path":/;

/**
 * Whether an `invalidParams` answer says the params did not fit the schema. A relay older than
 * `SCHEMA_REFUSAL` sent zod's message as it was, so that is recognised too.
 */
export function isSchemaRefusal(answer: { message: string; data?: unknown }): boolean {
  const { data } = answer;
  const marked = typeof data === "object" && data !== null && "schemaRefusal" in data;
  return marked || ISSUES.test(answer.message);
}
