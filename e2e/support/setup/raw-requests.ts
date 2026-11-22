import type { AppAccess } from "./app.ts";

/** A request written by hand, the way a browser or another program would send it. */
export interface RawRequest {
  method?: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
}

/** How the app answered: status, the stable error code if it refused, and the headers. */
export interface Answer {
  readonly status: number;
  readonly code: string | undefined;
  readonly headers: Headers;
  readonly body: string;
}

function codeOf(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { error?: { code?: string } };
    return parsed.error?.code;
  } catch {
    return undefined;
  }
}

/** Sends the request exactly as given (no token unless the headers carry one). */
export async function sendRaw(
  app: Pick<AppAccess, "baseUrl">,
  request: RawRequest,
): Promise<Answer> {
  const { method = "GET", path, headers = {}, body } = request;
  const json = body === undefined ? {} : { "content-type": "application/json" };
  const response = await fetch(`${app.baseUrl}${path}`, {
    method,
    headers: { ...json, ...headers },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, code: codeOf(text), headers: response.headers, body: text };
}
