import { createClient } from "@agentcontrol/sdk";
import type { AppAccess, Session } from "./app.ts";
import { openShell, type OpenShell } from "./terminal-user.ts";
import { Timeline } from "./timeline.ts";

const OUT_OF_DATE = "the-secret-of-an-earlier-start";

/**
 * Opens the terminal as a page does that was loaded before the app restarted: it holds an old
 * secret. `refusals` has one entry each time the app answered it with 401, which is when the page
 * reloads itself to get the new one.
 */
export function openShellWithAnOutOfDateSecret(
  app: AppAccess,
  call: { session: Session },
): { shell: OpenShell; refusals: Timeline<number> } {
  const refusals = new Timeline<number>(5000);
  const sdk = createClient({
    baseUrl: app.baseUrl,
    token: OUT_OF_DATE,
    onUnauthorized: () => {
      refusals.record(refusals.entries.length + 1);
    },
  });
  return { shell: openShell(app, { session: call.session, sdk }), refusals };
}
