import type { WorkspaceInfo } from "@agentcontrol/sdk";
import type { Session } from "./app.ts";
import { attemptApi } from "./app-attempt.ts";
import type { SshHost } from "./ssh-host.ts";
import type { RunningApp } from "./start-app.ts";

const onWorkspace = (info: WorkspaceInfo) => ({ workspaceId: info.id });

/** Adding, checking, restarting and removing workspaces, and reading what the app knows of them. */
function workspaceUserOf(app: RunningApp, host: SshHost) {
  return {
    /** Adds the ssh host as a workspace, as the "Add workspace" dialog does. */
    addsTheHost: () => app.sdk.workspaces.add({ kind: "ssh", host: host.alias }),
    triesToAdd: (hostName: string) =>
      attemptApi(app.sdk.workspaces.add({ kind: "ssh", host: hostName })),
    readsTheHostAliases: () => app.sdk.workspaces.hosts(),
    checksTheWorkspace: (info: WorkspaceInfo) => app.sdk.workspaces.check(info.id),
    removesTheWorkspace: (info: WorkspaceInfo) => app.sdk.workspaces.remove(info.id),
    triesToRemove: (id: string) => attemptApi(app.sdk.workspaces.remove(id)),
    restartsTheRelayOn: (info: WorkspaceInfo) => app.sdk.workspaces.restartRelay(info.id),
  };
}

/** What a person does with sessions on an ssh workspace. */
function sessionUserOf(app: RunningApp, host: SshHost) {
  const start = async (info: WorkspaceInfo, prompt: string) => {
    await host.mockAgent.writeScript();
    const session = { agent: "mock" as const, repoPath: host.repoPath, baseBranch: "main", prompt };
    return app.sdk.sessions.start({ ...session, ...onWorkspace(info) });
  };
  return {
    /** Starts a session on the host's repo; the host's agent gets the prompt once it is up. */
    startsSessionOn: async (
      info: WorkspaceInfo,
      options: { prompt: string },
    ): Promise<Session> => ({
      id: await start(info, options.prompt),
      title: options.prompt,
    }),
    triesToStartSessionOn: (info: WorkspaceInfo, options: { prompt: string }) =>
      attemptApi(start(info, options.prompt)),
    triesToSendMessage: (session: Session, text: string) =>
      attemptApi(app.sdk.sessions.sendPrompt(session.id, text)),
  };
}

/** What a person does about ssh workspaces in the app, each through the SDK. */
export function sshUserOf(app: RunningApp, host: SshHost) {
  return { ...workspaceUserOf(app, host), ...sessionUserOf(app, host) };
}

export type SshUser = ReturnType<typeof sshUserOf>;
