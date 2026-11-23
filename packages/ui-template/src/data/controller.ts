import type {
  Client,
  OpenTerminal,
  RepoId,
  RepoSetup,
  SessionId,
  StartSession,
} from "@agentcontrol/sdk";
import { saveFile } from "./changes-data.ts";
import {
  answerPermission,
  archiveSession,
  cancelTurn,
  resumeSession,
  sendPrompt,
  startSession,
} from "./commands.ts";
import { configActions } from "./config-actions.ts";
import { attempt, type Context, inBackground } from "./context.ts";
import { type FileChange, startLive } from "./live.ts";
import { initialState } from "./model.ts";
import { loadModify, modifyActions } from "./modify-data.ts";
import { createSelection } from "./selection.ts";
import { LOCAL_WORKSPACE, type SessionRef } from "./session-ref.ts";
import { loadSessions } from "./sessions-data.ts";
import { addRepository, saveSetup } from "./setup-data.ts";
import { createStore } from "./store.ts";
import { loadWorkspaces, workspaceActions } from "./workspaces-data.ts";

export type ControllerOptions = {
  client: Context["client"];
  /** Called with every failure the user should hear about. */
  report: (error: unknown) => void;
};

/** One function per thing the user can do to a session. */
function sessionActions(ctx: Context) {
  return {
    startSession: (request: StartSession) => startSession(ctx, request),
    sendPrompt: (id: SessionId, text: string) => sendPrompt(ctx, { id, text }),
    cancel: (id: SessionId) => cancelTurn(ctx, id),
    resume: (id: SessionId) => resumeSession(ctx, id),
    answerPermission: (id: SessionId, requestId: string, optionId: string) =>
      answerPermission(ctx, { id, requestId, optionId }),
    archive: (id: SessionId, force: boolean) => archiveSession(ctx, { id, force }),
    saveFile: (ref: SessionRef, path: string, content: string) =>
      attempt(ctx, () => saveFile(ctx, { ref, path, content })),
    /** What the sessions cost and how they went (the SDK's analytics). */
    analytics: ctx.client.analytics,
  };
}

/** One function per thing the user can do to a workspace's repositories. */
function repositoryActions(ctx: Context) {
  return {
    addRepository: (path: string, workspaceId = LOCAL_WORKSPACE) =>
      attempt(ctx, () => addRepository(ctx, { path, workspaceId })),
    saveSetup: (call: { workspaceId: string; repoId: RepoId; setup: RepoSetup }) =>
      attempt(ctx, () => saveSetup(ctx, call)),
  };
}

/** Who wants to hear about every change to a session's files, and how to tell them. */
function fileChangeListeners() {
  const listeners = new Set<(change: FileChange) => void>();
  return {
    tell: (change: FileChange): void => {
      for (const listener of [...listeners]) listener(change);
    },
    add: (listener: (change: FileChange) => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** What is fetched again whenever the live connection (re)opens. */
function resyncOf(ctx: Context, selection: ReturnType<typeof createSelection>): () => void {
  return () => {
    inBackground(ctx, Promise.all([loadSessions(ctx), loadWorkspaces(ctx)]));
    inBackground(ctx, loadModify(ctx));
    selection.reloadAll();
  };
}

/** What the UI asks of the SDK as it is, with no state of its own. */
function passedThrough(client: Client) {
  return {
    /** The address that shows a worktree file as a page (a new `?v=` each time, on the session's one preview ticket). */
    previewUrl: (id: SessionId, path: string) => client.files.previewUrl(id, path),
    /** Opens the user's shell in the session's folder (the Terminal tab). */
    openTerminal: (id: SessionId, options: OpenTerminal) => client.terminal.open(id, options),
  };
}

/** What the UI can ask for: the state to read, and the actions the user can take. */
export function createController({ client, report }: ControllerOptions) {
  const store = createStore(initialState);
  const ctx: Context = { client, store, report };
  const selection = createSelection(ctx);
  const changes = fileChangeListeners();
  const resync = resyncOf(ctx, selection);
  return {
    ...sessionActions(ctx),
    ...repositoryActions(ctx),
    workspaces: workspaceActions(ctx),
    config: configActions(ctx),
    modify: modifyActions(ctx),
    store,
    /** Starts the live connection; returns the function that stops it. */
    connect: () =>
      startLive(ctx, {
        resync,
        filesChanged: (change) => {
          selection.filesChanged(change.ref);
          changes.tell(change);
        },
      }),
    /** Calls `listener` for every change to a session's files; returns the function that stops it. */
    watchFileChanges: changes.add,
    ...passedThrough(client),
    select: selection.select,
    openFile: selection.openFile,
  };
}

export type Controller = ReturnType<typeof createController>;
