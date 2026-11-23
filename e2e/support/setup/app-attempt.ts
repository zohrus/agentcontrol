import { ApiError } from "@agentcontrol/sdk";

/** What came of a request the app may refuse: its result, or the refusal as the app gave it. */
export type ApiOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly status: number;
      readonly code: string;
      readonly message: string;
      readonly data: unknown;
    };

/** Waits for the request and reports a refusal by the app as an outcome instead of an error. */
export async function attemptApi<T>(request: Promise<T>): Promise<ApiOutcome<T>> {
  try {
    return { ok: true, value: await request };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return {
      ok: false,
      status: error.status,
      code: error.code,
      message: error.message,
      data: error.data,
    };
  }
}
