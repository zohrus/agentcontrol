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

/** The Add workspace form is open and the page notes which checklist rows the dialog shows. */
export async function opensTheAddFormWatchingTheSteps(app: SshAppInBrowser): Promise<void> {
  await app.page.opensTheWorkspaceMenu();
  await app.page.choosesAddWorkspace();
  await app.page.watchesTheSetupSteps();
}

/** The user types the ssh host's name into the open form and adds it. */
export async function addsTheHostInTheForm(app: SshAppInBrowser): Promise<void> {
  await app.page.typesTheHost(app.host.alias);
  await app.page.submitsTheHost();
}
