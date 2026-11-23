/** The part of a browser page the client reads; absent under Bun or Node. */
interface PageWithToken {
  document?: {
    querySelector(selector: string): { getAttribute(name: string): string | null } | null;
  };
}

/**
 * The secret the app put into the page it served (`<meta name="agentcontrol-token">`), or
 * undefined outside a browser page. The app adds it only to documents it serves itself.
 */
function tokenFromPage(): string | undefined {
  const { document } = globalThis as PageWithToken;
  const meta = document?.querySelector('meta[name="agentcontrol-token"]');
  return meta?.getAttribute("content") ?? undefined;
}

export interface AuthOptions {
  /** The secret to send; read from the page when left out. */
  token?: string | undefined;
  /** Called whenever the app answers 401 (its secret changed, for example after a restart). */
  onUnauthorized?: (() => void) | undefined;
}

/** The request's own headers (from `init`, or from a Request given as `input`) plus the secret. */
function headersOf(request: {
  input: Parameters<typeof fetch>[0];
  init: RequestInit | undefined;
  token: string | undefined;
}): Headers {
  const { input, init, token } = request;
  const own = init?.headers ?? (input instanceof Request ? input.headers : undefined);
  const headers = new Headers(own);
  if (token !== undefined) headers.set("authorization", `Bearer ${token}`);
  return headers;
}

/** Wraps `send` so every request carries `Authorization: Bearer <token>` and a 401 is reported. */
export function authorizedFetch(send: typeof fetch, options: AuthOptions): typeof fetch {
  const token = options.token ?? tokenFromPage();
  return Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
      const headers = headersOf({ input, init, token });
      const response = await send(input, { ...init, headers });
      if (response.status === 401) options.onUnauthorized?.();
      return response;
    },
    { preconnect: () => undefined },
  );
}
