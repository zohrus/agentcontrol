import { startSshHost, type SshHost } from "./ssh-host.ts";
import { type SshUser, sshUserOf } from "./ssh-user.ts";
import { type RunningApp, startAppWithLocalWorkspace } from "./start-app.ts";

/** The app with its local workspace, and another machine it can reach over ssh. */
export interface AppWithSshHost {
  readonly app: RunningApp;
  readonly host: SshHost;
  /** What the user does about ssh workspaces. */
  readonly user: SshUser;
}

/** Starts a private ssh host and an app that is set up to reach it (and nothing else over ssh). */
export async function startAppWithSshHost(): Promise<AppWithSshHost> {
  const host = await startSshHost();
  await host.mockAgent.writeScript();
  const app = await startAppWithLocalWorkspace({ ssh: host.appSettings });
  return { app, host, user: sshUserOf(app, host) };
}
