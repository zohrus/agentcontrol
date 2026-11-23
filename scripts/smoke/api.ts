// The few HTTP calls the smoke test makes against the app's API, with the app's secret.
import type { SmokeApp } from "./app-process.ts";

/** Calls the API (`/api/...`) and returns the parsed JSON; throws on a status other than 2xx. */
export async function callApi(
  app: SmokeApp,
  call: { method?: string; path: string; body?: unknown },
): Promise<unknown> {
  const answer = await fetch(`${app.baseUrl}${call.path}`, {
    method: call.method ?? "GET",
    headers: { authorization: `Bearer ${app.token}`, "content-type": "application/json" },
    ...(call.body === undefined ? {} : { body: JSON.stringify(call.body) }),
  });
  const text = await answer.text();
  if (!answer.ok) throw new Error(`${call.path} answered ${String(answer.status)}: ${text}`);
  return JSON.parse(text);
}

/** Calls `read` until it returns something (not undefined); throws after `seconds`. */
export async function waitUntil<T>(options: {
  what: string;
  seconds: number;
  read: () => Promise<T | undefined>;
}): Promise<T> {
  const deadline = Date.now() + options.seconds * 1000;
  while (Date.now() < deadline) {
    const value = await options.read();
    if (value !== undefined) return value;
    await Bun.sleep(200);
  }
  throw new Error(`timed out waiting for ${options.what}`);
}
