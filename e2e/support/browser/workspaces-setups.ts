import type { WorkspaceInfo } from "@agentcontrol/sdk";
import { type SshAppInBrowser, startSshAppInBrowser } from "./start-ssh-app-in-browser.ts";
import { expectWorkspaceGroupToShow } from "./workspaces-browser-expectations.ts";

/** The ssh host is a connected workspace with a session that the list shows under its name. */
export async function startSshAppWithASession(
  prompt: string,
): Promise<{ app: SshAppInBrowser; workspace: WorkspaceInfo }> {
  const app = await startSshAppInBrowser();
  const workspace = await app.ssh.addsTheHost();
  app.host.mockAgent.willReply("Working on the host");
  await app.ssh.startsSessionOn(workspace, { prompt });
  await expectWorkspaceGroupToShow(app, { workspace: app.host.alias, texts: [prompt] });
  return { app, workspace };
}
