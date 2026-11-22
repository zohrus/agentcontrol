import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { SessionId } from "@agentcontrol/protocol";
import type { SessionEvent } from "@agentcontrol/sdk";
import type { AppAccess, Session } from "./app.ts";
import { attemptApi } from "./app-attempt.ts";

const UNKNOWN_SESSION: Session = { id: SessionId.parse(crypto.randomUUID()), title: "no such" };

async function worktreeOf(app: AppAccess, session: Session): Promise<string> {
  const isCreation = (event: SessionEvent) =>
    event.sessionId === session.id && event.kind === "session-created";
  const created = await app.streamed.waitFor(isCreation, `expected "${session.title}" to exist`);
  if (created.kind !== "session-created") throw new Error("expected a session-created event");
  return created.payload.worktreePath;
}

/** What a person does in a session's worktree and with the session itself, through the SDK. */
export function appWorktreeUserOf(app: AppAccess) {
  return {
    looksUpSession: (session: Session) => app.sdk.sessions.get(session.id),
    triesToLookUpASessionThatDoesNotExist: () =>
      attemptApi(app.sdk.sessions.get(UNKNOWN_SESSION.id)),
    triesToSendAnEmptyMessage: (session: Session) =>
      attemptApi(app.sdk.sessions.sendPrompt(session.id, "")),
    triesToReadTheBaseVersionOf: (session: Session, path: string) =>
      attemptApi(app.sdk.files.read({ id: session.id, path, ref: "base" })),
    listsTheFiles: (session: Session) => app.sdk.files.tree(session.id),
    readsTheDiff: (session: Session) => app.sdk.sessions.diff(session.id),
    /** Cancels once the agent has been given its prompt. */
    cancelsTheTurn: async (session: Session): Promise<void> => {
      await app.streamed.waitFor(
        (event) => event.sessionId === session.id && event.kind === "prompt-sent",
        `expected the agent of "${session.title}" to be given its prompt before cancelling`,
      );
      await app.sdk.sessions.cancel(session.id);
    },
    triesToArchive: (session: Session) => attemptApi(app.sdk.sessions.archive(session.id)),
    /** Edits a file in the session's worktree from outside the app, as an editor would. */
    editsAFileInTheWorktree: async (session: Session, path: string): Promise<void> => {
      const file = join(await worktreeOf(app, session), path);
      await mkdir(dirname(file), { recursive: true });
      await Bun.write(file, "// edited outside the app\n");
    },
  };
}

/** What a person does with the workspace: repos, their setup, agents and the health checklist. */
export function appWorkspaceUserOf(app: AppAccess) {
  return {
    addsTheRepo: () => app.sdk.repos.add(app.repoPath),
    listsTheRepos: () => app.sdk.repos.list(),
    setsTheRepoSetupScript: async (script: string): Promise<void> => {
      const repo = await app.sdk.repos.add(app.repoPath);
      await app.sdk.repos.setSetup(repo.repoId, { copyFiles: [".env*"], setupScript: script });
    },
    listsTheAgents: () => app.sdk.agents.list(),
    readsTheWorkspace: () => app.sdk.workspace.get(),
    readsTheHealth: async (): Promise<{ ok: boolean; relay: string }> => {
      const response = await fetch(`${app.baseUrl}/api/health`);
      return (await response.json()) as { ok: boolean; relay: string };
    },
    readsTheChecklist: () => app.sdk.workspace.check(),
    triesToListTheAgents: () => attemptApi(app.sdk.agents.list()),
  };
}
