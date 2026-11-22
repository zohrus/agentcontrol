/** A request the app answered with an error. `code` is stable, `message` is for people. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Extra facts, e.g. `{ currentHash }` for `stale-file` or `{ uncommittedFiles }` for `uncommitted-changes`. */
  readonly data: unknown;

  constructor(status: number, error: { code: string; message: string; data?: unknown }) {
    super(error.message);
    this.status = status;
    this.code = error.code;
    this.data = error.data;
  }
}

/** What both `hc` responses and plain `fetch` responses offer. */
interface Answer<T> {
  ok: boolean;
  status: number;
  json: () => Promise<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorFrom(status: number, body: unknown): ApiError {
  const error = isRecord(body) ? body["error"] : undefined;
  if (!isRecord(error)) {
    return new ApiError(status, {
      code: "unknown",
      message: `The app answered ${String(status)}.`,
    });
  }
  const { code, message, data } = error;
  return new ApiError(status, { code: String(code), message: String(message), data });
}

/** Resolves with the JSON body of a successful answer; throws an ApiError for any other status. */
export async function read<T>(pending: Promise<Answer<T>>): Promise<T> {
  const answer = await pending;
  if (answer.ok) return answer.json();
  const body: unknown = await (answer.json() as Promise<unknown>).catch(() => undefined);
  throw errorFrom(answer.status, body);
}
