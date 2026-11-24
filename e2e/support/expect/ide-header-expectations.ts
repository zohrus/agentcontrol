import type { IdeTab } from "../setup/ide-user.ts";

/** Code-server's answers carry this header with this value. */
export async function expectAnswerHeader(
  tab: IdeTab,
  call: { path: string; header: string; value: string },
): Promise<void> {
  const answer = await tab.loads(call.path);
  const shown = answer.headers.get(call.header);
  if (shown?.includes(call.value) !== true) {
    throw new Error(
      `expected "${call.path}" to answer with ${call.header} containing "${call.value}", but it was ${String(shown)}`,
    );
  }
}

/** The browser's answer from this path has no such header: the tunnel did not pass it on. */
export async function expectAnswerWithoutHeader(
  tab: IdeTab,
  call: { path: string; header: string },
): Promise<void> {
  const shown = (await tab.loads(call.path)).headers.get(call.header);
  if (shown !== null) {
    throw new Error(
      `expected "${call.path}" to answer without ${call.header}, but it said ${shown}`,
    );
  }
}

async function headersSeenByCodeServer(
  tab: IdeTab,
  sent: Record<string, string>,
): Promise<Record<string, string>> {
  const answer = await tab.loads("headers", { headers: sent });
  return (await answer.json()) as Record<string, string>;
}

/** What code-server sees of the browser's request: its Host and Origin are the IDE origin's own. */
export async function expectCodeServerToSeeTheBrowsersHostAndOrigin(tab: IdeTab): Promise<void> {
  const seen = await headersSeenByCodeServer(tab, { origin: tab.origin });
  const host = new URL(tab.origin).host;
  if (seen["host"] !== host || seen["origin"] !== tab.origin) {
    throw new Error(
      `expected code-server to see Host ${host} and Origin ${tab.origin}, but it saw ${JSON.stringify({ host: seen["host"], origin: seen["origin"] })}`,
    );
  }
}

/** Cookies of other servers on 127.0.0.1 (cookies ignore ports) never reach code-server. */
export async function expectCodeServerToSeeNoCookie(tab: IdeTab): Promise<void> {
  const seen = await headersSeenByCodeServer(tab, {
    cookie: "session=another-servers-secret",
    authorization: "Bearer another-servers-secret",
  });
  const leaked = Object.keys(seen).filter((name) => name === "cookie" || name === "authorization");
  if (leaked.length > 0) {
    throw new Error(
      `expected code-server to see no cookie or authorization, but it saw ${leaked.join(", ")}`,
    );
  }
}
