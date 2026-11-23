import type { Client, RepoId, RepoSetup, SessionId, StartSession } from "@agentcontrol/sdk";
import { saveFile } from "./changes-data.ts";
import {
  answerPermission,
  archiveSession,
  cancelTurn,
  sendPrompt,
  startSession,
} from "./commands.ts";
import { attempt, type Context, inBackground } from "./context.ts";
import { startLive } from "./live.ts";
import { initialState } from "./model.ts";
import { loadModify, modifyActions } from "./modify-data.ts";
import { createSelection } from "./selection.ts";
import { loadSessions } from "./sessions-data.ts";
import { addRepository, checkWorkspace, loadChoices, saveSetup } from "./setup-data.ts";
import { createStore } from "./store.ts";

export type ControllerOptions = {
  client: Client;
  /** Called with every failure the user should hear about. */
  report: (error: unknown) => void;
};

/** One function per thing the user can do. */
function userActions(ctx: Context) {
  return {
    startSession: (request: StartSession) => startSession(ctx, request),
    sendPrompt: (id: SessionId, text: string) => sendPrompt(ctx, { id, text }),
    cancel: (id: SessionId) => cancelTurn(ctx, id),
    answerPermission: (id: SessionId, requestId: string, optionId: string) =>
      answerPermission(ctx, { id, requestId, optionId }),
    archive: (id: SessionId, force: boolean) => archiveSession(ctx, { id, force }),
    saveFile: (id: SessionId, path: string, content: string) =>
      attempt(ctx, () => saveFile(ctx, { id, path, content })),
    addRepository: (path: string) => attempt(ctx, () => addRepository(ctx, path)),
    saveSetup: (repoId: RepoId, setup: RepoSetup) =>
      attempt(ctx, () => saveSetup(ctx, { repoId, setup })),
    checkWorkspace: () => attempt(ctx, () => checkWorkspace(ctx)),
    modify: modifyActions(ctx),
  };
}

/** What the UI can ask for: the state to read, and the actions the user can take. */
export function createController({ client, report }: ControllerOptions) {
  const store = createStore(initialState);
  const ctx: Context = { client, store, report };
  const selection = createSelection(ctx);
  const resync = (): void => {
    inBackground(ctx, Promise.all([loadSessions(ctx), loadChoices(ctx)]));
    inBackground(ctx, loadModify(ctx));
    selection.reloadAll();
  };
  return {
    ...userActions(ctx),
    store,
    /** Starts the live connection; returns the function that stops it. */
    connect: () => startLive(ctx, { resync, filesChanged: selection.filesChanged }),
    select: selection.select,
    openFile: selection.openFile,
  };
}

export type Controller = ReturnType<typeof createController>;
