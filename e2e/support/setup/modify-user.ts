import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { AppAccess } from "./app.ts";
import { modifyMoreUserOf } from "./modify-more-user.ts";

/** What a person does to change the UI itself: ask, then Keep or Undo, or go back to a version. */
export function modifyUserOf(app: AppAccess) {
  return {
    /** Asks the Modify agent for a change; it works in the background. */
    asksToModifyTheUi: async (request: string) => {
      await app.mockAgent.writeScript();
      return app.sdk.modify.request(request);
    },
    keepsTheChange: () => app.sdk.modify.keep(),
    undoesTheChange: () => app.sdk.modify.undo(),
    discardsTheChange: () => app.sdk.modify.discard(),
    /** Presses "Update" on the banner that offers the new default UI. */
    appliesTheDefaultUiUpdate: async () => {
      await app.mockAgent.writeScript();
      return app.sdk.modify.applyUpdate();
    },
    readsUiVersions: () => app.sdk.modify.history(),
    restoresUiVersion: (commit: string) => app.sdk.modify.restore(commit),
    readsModifyState: () => app.sdk.modify.state(),
    ...safePageUserOf(app),
    ...modifyMoreUserOf(app),
  };
}

import { tokenInHtml } from "./browser.ts";

/** What a person does on the recovery page, which the app serves itself. */
function safePageUserOf(app: AppAccess) {
  return {
    /** Opens the recovery page, as the browser would. */
    opensTheSafePage: async () => (await fetch(`${app.baseUrl}/_safe`)).text(),
    /** Presses the Restore button next to a version on the recovery page: it posts that commit. */
    pressesRestoreOnTheSafePage: async (page: string, message: string) => {
      const commit = commitListedWith(page, message);
      await fetch(`${app.baseUrl}/api/modify/restore`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${String(tokenInHtml(page))}`,
        },
        body: JSON.stringify({ commit }),
      });
    },
    /** Something broke the live UI so badly that its folder is gone. */
    deletesTheLiveUiFolder: () => rm(join(app.dataDir, "ui"), { recursive: true, force: true }),
  };
}

/** The commit of the Restore button in the list item that shows `message`. */
function commitListedWith(page: string, message: string): string {
  const item = page.split("<li>").find((part) => part.includes(message));
  const commit = /data-commit="([0-9a-f]+)"/.exec(item ?? "")?.[1];
  if (!commit)
    throw new Error(`expected the recovery page to have a Restore button for "${message}"`);
  return commit;
}
