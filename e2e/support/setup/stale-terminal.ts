import { createClient } from "@agentcontrol/sdk";
import type { AppAccess, Session } from "./app.ts";
import { type OpenShell, openShell } from "./terminal-user.ts";
import { Timeline } from "./timeline.ts";

const OUT_OF_DATE = "the-secret-of-an-earlier-start";

/**
 * A page that was loaded before the app restarted: it holds an old secret. `refusals` has one
 * entry each time the app answered it with 401, which is when the page reloads itself.
 */
export function aPageWithAnOutOfDateSecret(app: AppAccess): {
  refusals: Timeline<number>;
  opensTerminalOn: (session: Session) => OpenShell;
} {
  const refusals = new Timeline<number>(5000);
  const sdk = createClient({
    baseUrl: app.baseUrl,
    token: OUT_OF_DATE,
    onUnauthorized: () => {
      refusals.record(refusals.entries.length + 1);
    },
  });
  return { refusals, opensTerminalOn: (session) => openShell(app, { session, sdk }) };
}

/** Opens the terminal as such a page does. */
export function openShellWithAnOutOfDateSecret(
  app: AppAccess,
  call: { session: Session },
): { shell: OpenShell; refusals: Timeline<number> } {
  const page = aPageWithAnOutOfDateSecret(app);
  return { shell: page.opensTerminalOn(call.session), refusals: page.refusals };
}
