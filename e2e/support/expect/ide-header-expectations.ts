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

/** What code-server sees of the browser's request: its Host and Origin are the IDE origin's own. */
export async function expectCodeServerToSeeTheBrowsersHostAndOrigin(tab: IdeTab): Promise<void> {
  const answer = await tab.loads("headers", { headers: { origin: tab.origin } });
  const seen = (await answer.json()) as Record<string, string>;
  const host = new URL(tab.origin).host;
  if (seen["host"] !== host || seen["origin"] !== tab.origin) {
    throw new Error(
      `expected code-server to see Host ${host} and Origin ${tab.origin}, but it saw ${JSON.stringify({ host: seen["host"], origin: seen["origin"] })}`,
    );
  }
}
