import { ErrorCode } from "@agentcontrol/protocol";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ModifyRefusal } from "../modify/index.ts";
import { RelayCallError, RelayConnectionClosedError } from "../relays/index.ts";
import { RelayUnavailableError } from "../sync/index.ts";

/** A failure the API reports as `{error: {code, message, data?}}` with an HTTP status. */
export class ApiFailure extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly error: { code: string; message: string; data?: unknown },
  ) {
    super(error.message);
  }
}

const relayFailures: Record<number, { status: ContentfulStatusCode; code: string }> = {
  [ErrorCode.sessionNotFound]: { status: 404, code: "session-not-found" },
  [ErrorCode.uncommittedChanges]: { status: 409, code: "uncommitted-changes" },
  [ErrorCode.staleFile]: { status: 409, code: "stale-file" },
  [ErrorCode.setupFailed]: { status: 422, code: "setup-failed" },
  [ErrorCode.fileNotFound]: { status: 404, code: "file-not-found" },
  [ErrorCode.fileTooLarge]: { status: 413, code: "file-too-large" },
  [ErrorCode.configStale]: { status: 409, code: "config-plan-stale" },
  [ErrorCode.sessionArchived]: { status: 409, code: "session-archived" },
  [ErrorCode.terminalNotFound]: { status: 404, code: "terminal-not-found" },
  [ErrorCode.invalidParams]: { status: 400, code: "invalid-request" },
};
const unknownFailure = { status: 500, code: "internal-error" } as const;

function fromRelay(error: RelayCallError): ApiFailure {
  const { status, code } = relayFailures[error.code] ?? unknownFailure;
  return new ApiFailure(status, { code, message: error.message, data: error.data });
}

function otherFailure(error: Error): ApiFailure {
  const bad = error instanceof HTTPException;
  const [status, code] = bad
    ? ([400, "invalid-request"] as const)
    : ([500, "internal-error"] as const);
  return new ApiFailure(status, { code, message: error.message });
}

function fromModify(error: ModifyRefusal): ApiFailure {
  const status = error.code === "invalid-request" ? 400 : 409;
  return new ApiFailure(status, { code: error.code, message: error.message });
}

/** Failures a route threw on purpose: already an API failure, or a refusal of the relay or Modify. */
function intended(error: Error): ApiFailure | undefined {
  if (error instanceof ApiFailure) return error;
  if (error instanceof RelayCallError) return fromRelay(error);
  return error instanceof ModifyRefusal ? fromModify(error) : undefined;
}

/** Errors that say the relay cannot be reached (never there, or the connection ended). */
const RELAY_GONE = [RelayUnavailableError, RelayConnectionClosedError];

/** The API failure a thrown error stands for (an unknown one is a 500). */
export function failureOf(error: Error): ApiFailure {
  const known = intended(error);
  if (known) return known;
  if (!RELAY_GONE.some((kind) => error instanceof kind)) return otherFailure(error);
  return new ApiFailure(503, { code: "relay-unavailable", message: error.message });
}

/** Turns anything a route threw into the API's JSON error body. */
export function reportFailure(error: Error, c: Context): Response {
  const failure = failureOf(error);
  return c.json({ error: failure.error }, failure.status);
}
