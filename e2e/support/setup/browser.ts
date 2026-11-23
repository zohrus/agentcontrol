import type { AppAccess } from "./app.ts";
import { type Answer, sendRaw } from "./raw-requests.ts";

/** A browser of the user's: it uses the secret found in the page the app served, nothing else. */
export interface Browser {
  /** Types the app's address into the address bar. */
  opensTheAppPage(): Promise<Answer>;
  /** The page's own script asking for the sessions, as the UI does. */
  listsTheSessions(): Promise<Answer>;
}

/** The secret in `<meta name="agentcontrol-token">`, as the SDK reads it in the page. */
export function tokenInHtml(html: string): string | undefined {
  return /<meta name="agentcontrol-token" content="([^"]+)">/.exec(html)?.[1];
}

/** The secret in the page the app answered with. */
export function tokenInPage(page: Answer): string | undefined {
  return tokenInHtml(page.body);
}

/** A browser that has not yet opened any page of the app. */
export function aBrowser(app: AppAccess): Browser {
  let token: string | undefined;
  const page = { origin: app.baseUrl, "sec-fetch-site": "same-origin" };
  return {
    opensTheAppPage: async () => {
      const answer = await sendRaw(app, { path: "/", headers: { accept: "text/html" } });
      token = tokenInPage(answer);
      return answer;
    },
    listsTheSessions: () =>
      sendRaw(app, {
        path: "/api/sessions",
        headers: { ...page, ...(token && { authorization: `Bearer ${token}` }) },
      }),
  };
}
