import type { AppAccess } from "./app.ts";
import type { IdeTab } from "./ide-user.ts";
import { type Answer, sendRaw } from "./raw-requests.ts";

const OTHER_SITE = {
  origin: "https://evil.example",
  "sec-fetch-site": "cross-site",
  "sec-fetch-mode": "cors",
};

const UPGRADE = {
  upgrade: "websocket",
  connection: "Upgrade",
  "sec-websocket-version": "13",
  "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
};

/** Callers that reach the IDE's own port without being the workbench page of a session. */
export function ideOutsidersOf(tab: IdeTab) {
  const here = { baseUrl: tab.origin };
  const { pathname } = new URL(tab.url);
  return {
    asksForTheRoot: (): Promise<Answer> => sendRaw(here, { path: "/" }),
    asksForTheAppsApi: (): Promise<Answer> => sendRaw(here, { path: "/api/sessions" }),
    asksUnderTheTicketWithAnotherHost: (): Promise<Answer> =>
      sendRaw(here, { path: pathname, headers: { host: "evil.example" } }),
    asksUnderTheTicketFromAnotherWebsite: (): Promise<Answer> =>
      sendRaw(here, { path: pathname, headers: OTHER_SITE }),
    opensASocketFromAnotherWebsite: (): Promise<Answer> =>
      sendRaw(here, { path: `${pathname}socket`, headers: { ...UPGRADE, ...OTHER_SITE } }),
  };
}

/** What a script running on the IDE's origin could send to the app, with the app's own secret even. */
export function appOutsiderOnTheIdeOrigin(call: { app: AppAccess; tab: IdeTab }) {
  const { app, tab } = call;
  const fromThere = { origin: tab.origin, "sec-fetch-site": "same-site", "sec-fetch-mode": "cors" };
  return {
    callsTheApiWithTheSecret: (): Promise<Answer> =>
      sendRaw(app, {
        path: "/api/sessions",
        headers: { ...fromThere, authorization: `Bearer ${app.token}` },
      }),
    readsTheAppsPage: (): Promise<Answer> => sendRaw(app, { path: "/", headers: fromThere }),
  };
}

/** Asking the app for an address without its secret, as another program on the machine would. */
export function asksForAnIdeAddressWithoutTheSecret(
  app: AppAccess,
  sessionId: string,
): Promise<Answer> {
  return sendRaw(app, { method: "POST", path: `/api/sessions/${sessionId}/ide` });
}
