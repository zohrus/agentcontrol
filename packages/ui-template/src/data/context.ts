import { ApiError, type Client } from "@agentcontrol/sdk";
import type { DataState } from "./model.ts";
import type { Store } from "./store.ts";

/** What every loader needs: the SDK, the state, and a way to tell the user about a failure. */
export type Context = {
  client: Client;
  store: Store<DataState>;
  report: (error: unknown) => void;
};

/**
 * Runs a load nobody is waiting for. The app answering with an error is reported; the app being
 * unreachable is not, since the connection indicator already says so and the load repeats on reconnect.
 */
export function inBackground(ctx: Context, work: Promise<unknown>): void {
  work.catch((error: unknown) => {
    if (error instanceof ApiError) ctx.report(error);
  });
}

/** Runs something the user asked for; any failure is reported and the result is undefined. */
export async function attempt<T>(ctx: Context, work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work();
  } catch (error) {
    ctx.report(error);
    return undefined;
  }
}
