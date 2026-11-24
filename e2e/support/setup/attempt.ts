import { RelayCallError } from "./relay-client.ts";

/** What came of a call the relay may refuse: its result, or the refusal in plain words. */
export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: number;
      readonly message: string;
      readonly data?: unknown;
    };

/** Waits for the call and reports a refusal by the relay as an outcome instead of an error. */
export async function attempt<T>(call: Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await call };
  } catch (error) {
    if (error instanceof RelayCallError) {
      return { ok: false, code: error.code, message: error.message, data: error.data };
    }
    throw error;
  }
}
