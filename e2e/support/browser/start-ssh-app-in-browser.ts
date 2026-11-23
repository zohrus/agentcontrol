import { startSshHost, type SshHost } from "../setup/ssh-host.ts";
import type { SshHostOptions } from "../setup/ssh-host-options.ts";
import { type SshUser, sshUserOf } from "../setup/ssh-user.ts";
import { startAppWithLocalWorkspace } from "../setup/start-app.ts";
import { type AppInBrowser, openInBrowser } from "./start-app-in-browser.ts";

/** The app open in a browser, and another machine it can reach over ssh. */
export type SshAppInBrowser = AppInBrowser & {
  readonly host: SshHost;
  /** What a person does about ssh workspaces, through the SDK (to set things up). */
  readonly ssh: SshUser;
};

/** Starts a private ssh host and the app with its UI, set up to reach that host. */
export async function startSshAppInBrowser(options: SshHostOptions = {}): Promise<SshAppInBrowser> {
  const host = await startSshHost(options);
  await host.mockAgent.writeScript();
  const app = await startAppWithLocalWorkspace({ withUi: true, ssh: host.appSettings });
  const opened = await openInBrowser(app);
  return Object.assign(opened, { host, ssh: sshUserOf(app, host) });
}
