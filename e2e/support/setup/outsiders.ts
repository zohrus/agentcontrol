import type { SessionEvent } from "@agentcontrol/sdk";
import type { AppAccess, Session } from "./app.ts";
import { optionOfKind } from "./permission-option.ts";
import { type Answer, sendRaw } from "./raw-requests.ts";

const OTHER_SITE = { origin: "https://evil.example", "sec-fetch-site": "cross-site" };

/** The stream's request is answered with an error at once, so it can be read like any other. */
const stream = (headers: Record<string, string>) => ({
  path: "/api/stream",
  headers: { accept: "text/event-stream", ...headers },
});

type PermissionRequest = Extract<SessionEvent, { kind: "permission-requested" }>;

async function approvalRequestOf(app: AppAccess, session: Session) {
  const asked = await app.streamed.waitFor(
    (event) => event.kind === "permission-requested" && event.sessionId === session.id,
    `expected "${session.title}" to ask for permission before the website answers it`,
  );
  const { requestId, options } = (asked as PermissionRequest).payload;
  return { requestId, optionId: optionOfKind(options, "allow_once", session.title) };
}

async function approve(app: AppAccess, session: Session, headers: Record<string, string>) {
  const { requestId, optionId } = await approvalRequestOf(app, session);
  return sendRaw(app, {
    method: "POST",
    path: `/api/sessions/${session.id}/permissions/${requestId}`,
    headers,
    body: { optionId },
  });
}

const listSessions = (headers: Record<string, string>) => ({ path: "/api/sessions", headers });

/** Callers that arrive from somewhere else than the app's own page. */
function foreignCallersOf(app: AppAccess) {
  return {
    /** A page open in the user's browser, on another site, calling the app's address. */
    aWebsiteTriesTo: {
      approveTheCommand: (session: Session): Promise<Answer> => approve(app, session, OTHER_SITE),
      listTheSessions: (): Promise<Answer> => sendRaw(app, listSessions(OTHER_SITE)),
    },
    /** Someone on another site who links to the app: the user clicks, the browser navigates. */
    aLinkOnAnotherWebsite: {
      opensTheAppPage: (): Promise<Answer> =>
        sendRaw(app, {
          path: "/",
          headers: {
            "sec-fetch-site": "cross-site",
            accept: "text/html",
            "sec-fetch-mode": "navigate",
          },
        }),
      /** The same site's script fetching the page to read it, which is not a navigation. */
      readsTheAppPage: (): Promise<Answer> =>
        sendRaw(app, { path: "/", headers: { ...OTHER_SITE, "sec-fetch-mode": "cors" } }),
    },
    /** A name that points at this machine only through DNS rebinding. */
    aRebindingHostnameTriesTo: {
      listTheSessions: (): Promise<Answer> =>
        sendRaw(app, listSessions({ authorization: `Bearer ${app.token}`, host: "evil.example" })),
    },
  };
}

/** Local programs that do not hold the secret. */
function programsWithoutTheTokenOf(app: AppAccess) {
  return {
    /** A local program that does not hold the secret. */
    aProgramWithoutTheToken: {
      listsTheSessions: (): Promise<Answer> => sendRaw(app, listSessions({})),
      /** What the recovery page's script does, minus the token. */
      callsTheRecoveryPageApi: (): Promise<Answer> =>
        sendRaw(app, { method: "POST", path: "/api/modify/undo" }),
      asksTheModifyAgentToChangeTheUi: (): Promise<Answer> =>
        sendRaw(app, { method: "POST", path: "/api/modify", body: { request: "Make it blue" } }),
      readsTheHarnessConfig: (): Promise<Answer> => sendRaw(app, { path: "/api/config/items" }),
      opensTheLiveStream: (): Promise<Answer> => sendRaw(app, stream({})),
    },
  };
}

/** Callers that are not the app's own client, each trying something the app must refuse. */
export type Outsiders = ReturnType<typeof outsidersOf>;

/** The outsiders for this app. */
export function outsidersOf(app: AppAccess) {
  return {
    ...foreignCallersOf(app),
    ...programsWithoutTheTokenOf(app),
    /** A local program that was given the secret by reading the token file. */
    aProgramWithTheToken: {
      /** A file of the session's worktree, read through the files API. */
      readsAFileOfASession: (session: Session, path: string): Promise<Answer> =>
        sendRaw(app, {
          path: `/api/sessions/${session.id}/file?path=${encodeURIComponent(path)}&ref=working`,
          headers: { authorization: `Bearer ${app.token}` },
        }),
      listsTheSessions: (): Promise<Answer> =>
        sendRaw(app, listSessions({ authorization: `Bearer ${app.token}` })),
    },
    aProgramWithAWrongToken: {
      listsTheSessions: (): Promise<Answer> =>
        sendRaw(app, listSessions({ authorization: "Bearer not-the-secret" })),
    },
  };
}
