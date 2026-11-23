import { join } from "node:path";
import { folderAt, type Folder, temporaryFolder } from "../setup/config-app.ts";
import { startAppInBrowser, type AppInBrowser } from "./start-app-in-browser.ts";

/** The app open in a browser, with a fake home folder in place of the user's own. */
export type ConfigAppInBrowser = AppInBrowser & { readonly home: Folder };

/**
 * Starts the app with the UI so that agent configuration is written to a throwaway home folder.
 * `handWritten` puts files in that folder first, as a user's own setup would be.
 */
export async function startConfigAppInBrowser(
  handWritten: Record<string, string> = {},
): Promise<ConfigAppInBrowser> {
  const homePath = await temporaryFolder("agentcontrol-home-");
  const home = folderAt(homePath, [join(".agentcontrol", "backups")]);
  for (const [file, content] of Object.entries(handWritten)) await home.has(file, content);
  const app = await startAppInBrowser({ relayEnv: { AGENTCONTROL_CONFIG_HOME: homePath } });
  return Object.assign(app, { home });
}
