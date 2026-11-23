import type { AppAccess } from "./app.ts";
import { type Answer, sendRaw } from "./raw-requests.ts";

/** What a browser sends for a request made by a page in a sandbox with an opaque origin. */
const FROM_A_SANDBOXED_PAGE = {
  origin: "null",
  "sec-fetch-site": "cross-site",
  "sec-fetch-mode": "no-cors",
  "sec-fetch-dest": "script",
} as const;

/** What a previewed page does with the app, as the requests a sandboxed browser frame would send. */
export function sandboxedPageUserOf(app: AppAccess) {
  return {
    /** A file of the page, asked for from inside the sandbox by an address of the preview. */
    asksForItsFileLikeASandboxedPage: (address: string, relativePath = ""): Promise<Answer> => {
      const { pathname, search } = new URL(relativePath, address);
      return sendRaw(app, { path: `${pathname}${search}`, headers: FROM_A_SANDBOXED_PAGE });
    },
    /** Another site's page, which was sent the leaked address, tries to read the file with fetch. */
    readsItsFileWithFetchLikeAnotherSite: (address: string): Promise<Answer> => {
      const { pathname, search } = new URL(address);
      const headers = {
        ...FROM_A_SANDBOXED_PAGE,
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
      };
      return sendRaw(app, { path: `${pathname}${search}`, headers });
    },
    /** The page's script reaches for the app's API, with no secret to show. */
    reachesForTheApiLikeASandboxedPage: (): Promise<Answer> =>
      sendRaw(app, { path: "/api/sessions", headers: FROM_A_SANDBOXED_PAGE }),
  };
}
