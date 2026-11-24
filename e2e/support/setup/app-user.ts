import type { FileContent, SessionEvent } from "@agentcontrol/sdk";
import { type ApiError, isStaleFile } from "@agentcontrol/sdk";
import type { AppAccess, Session } from "./app.ts";
import { modifyUserOf } from "./modify-user.ts";
import { appWorkspaceUserOf, appWorktreeUserOf } from "./app-more-user.ts";
import { appBaseUserOf } from "./app-base-user.ts";
import { appPreviewUserOf } from "./preview-user.ts";
import { optionOfKind } from "./permission-option.ts";

type PermissionRequest = Extract<SessionEvent, { kind: "permission-requested" }>;

/** The outcome of saving a file: saved, or refused with the reason the app gave. */
export type SaveOutcome =
  | { saved: true; hash: string }
  | { saved: false; status: number; code: string; currentHash: string | undefined };

const isRequestFor = (session: Session) => (event: SessionEvent) =>
  event.kind === "permission-requested" && event.sessionId === session.id;

async function answer(app: AppAccess, call: { session: Session; kind: string }): Promise<void> {
  const { session } = call;
  const event = await app.streamed.waitFor(
    isRequestFor(session),
    `expected session "${session.title}" to ask for permission before the user answers`,
  );
  const { requestId, options } = (event as PermissionRequest).payload;
  const optionId = optionOfKind(options, call.kind, session.title);
  await app.sdk.sessions.answerPermission(session.id, requestId, optionId);
}

function currentHashOf(error: ApiError): string | undefined {
  const data = error.data as { currentHash?: string } | undefined;
  return data?.currentHash;
}

async function save(
  app: AppAccess,
  edit: { session: Session; path: string; content: string; basedOn: FileContent },
): Promise<SaveOutcome> {
  const { session, path, content, basedOn } = edit;
  const write = { id: session.id, path, content, expectedHash: basedOn.hash };
  try {
    return { saved: true, hash: await app.sdk.files.write(write) };
  } catch (error) {
    if (!isStaleFile(error)) throw error;
    const { status, code } = error;
    return { saved: false, status, code, currentHash: currentHashOf(error) };
  }
}

/** Sessions and files: what a person does in the app, each one through the SDK. */
function sessionUserOf(app: AppAccess) {
  return {
    ...modifyUserOf(app),
    /** Starts a session on the local repo; the agent gets the prompt once it is up. */
    startsSession: async (options: { prompt: string }): Promise<Session> => {
      await app.mockAgent.writeScript();
      const id = await app.sdk.sessions.start({
        agent: "mock",
        repoPath: app.repoPath,
        baseBranch: "main",
        prompt: options.prompt,
      });
      return { id, title: options.prompt };
    },
    allowsTheCommand: (session: Session) => answer(app, { session, kind: "allow_once" }),
    rejectsTheCommand: (session: Session) => answer(app, { session, kind: "reject_once" }),
    sendsMessage: (session: Session, text: string) => app.sdk.sessions.sendPrompt(session.id, text),
    archivesSession: (session: Session, options: { force?: boolean } = {}) =>
      app.sdk.sessions.archive(session.id, options),
    /** Reads the session's whole recorded history, as the UI does when opening a session. */
    readsHistoryOf: (session: Session) => app.sdk.sessions.events(session.id, { after: 0 }),
    opensFile: (session: Session, path: string) => app.sdk.files.read({ id: session.id, path }),
    /** Saves an edit made on top of a view of the file the user opened earlier. */
    savesFile: (session: Session, edit: { path: string; content: string; basedOn: FileContent }) =>
      save(app, { session, ...edit }),
  };
}

/** The things a person does in the app, each one through the SDK. Extend when a test needs more. */
export function appUserOf(app: AppAccess) {
  return {
    ...sessionUserOf(app),
    ...appWorktreeUserOf(app),
    ...appWorkspaceUserOf(app),
    ...appBaseUserOf(app),
    ...appPreviewUserOf(app),
  };
}

export type AppUser = ReturnType<typeof appUserOf>;
