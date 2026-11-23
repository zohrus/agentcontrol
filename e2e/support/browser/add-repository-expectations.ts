import { eventually } from "../setup/eventually.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

const BROWSER_WAIT_MS = 15_000;

/** A failure notice says `notice`, and the folder field is still there with the typed folder. */
export function expectRepositoryFolderToStayForRetry(
  app: AppInBrowser,
  expected: { folder: string; notice: string },
): Promise<void> {
  const { folder, notice } = expected;
  return eventually(
    `expected a notice saying "${notice}" and the folder field to still hold "${folder}"`,
    async () => {
      const shown = await app.page.failureNoticeText();
      if (!shown.includes(notice)) return `the notice reads "${shown}"`;
      const field = await app.page.repositoryFolderField();
      return field === folder ? undefined : `the folder field is ${JSON.stringify(field)}`;
    },
    BROWSER_WAIT_MS,
  );
}
