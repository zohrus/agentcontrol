import { ErrorCode } from "@agentcontrol/protocol";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
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
  [ErrorCode.configStale]: { status: 409, code: "config-plan-stale" },
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

function failureOf(error: Error): ApiFailure {
  if (error instanceof ApiFailure) return error;
  if (error instanceof RelayCallError) return fromRelay(error);
  const gone =
    error instanceof RelayUnavailableError || error instanceof RelayConnectionClosedError;
  if (!gone) return otherFailure(error);
  return new ApiFailure(503, { code: "relay-unavailable", message: error.message });
}

/** Turns anything a route threw into the API's JSON error body. */
export function reportFailure(error: Error, c: Context): Response {
  const failure = failureOf(error);
  return c.json({ error: failure.error }, failure.status);
}
