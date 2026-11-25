import { join } from "node:path";
import { expectUiChangeReadyToKeep } from "../expect/modify-expectations.ts";
import { sessionTableWith } from "./fixture-ui.ts";
import {
  type ModifiableApp,
  releaseDefaultUiUpdate,
  startAppWithModifiableUi,
} from "./modify-app.ts";
import { userKeptTableColumns } from "./modify-history.ts";

/** A line of the default UI that no build can read. */
const UNREADABLE_SOURCE = "export const = ;\n";

/** What the shipped, already built default UI says on its page. */
export const SHIPPED_BUILD_MARKER = "Default UI as the release ships it built";

/** The app started the way a release starts: it serves a production build of its UI folder. */
export function startsAppLikeARelease(): Promise<ModifiableApp> {
  return startAppWithModifiableUi({ productionUi: true });
}

/** The app started like a release whose default UI is already built in the release folder. */
export function startsAppLikeAReleaseThatShipsTheUiBuilt(): Promise<ModifiableApp> {
  const html = `<!doctype html><html><head><title>${SHIPPED_BUILD_MARKER}</title></head><body></body></html>`;
  return startAppWithModifiableUi({
    productionUi: true,
    templateFiles: { "dist/index.html": html },
  });
}

/** The app started like a release whose default UI cannot be built (nothing was built before). */
export function startsAppLikeAReleaseWhoseUiCannotBeBuilt(): Promise<ModifiableApp> {
  return startAppWithModifiableUi({
    productionUi: true,
    templateFiles: { "src/main.ts": UNREADABLE_SOURCE },
  });
}

/** Someone edits a file of the live UI folder by hand, and leaves it unreadable to the build. */
async function theLiveUiIsEditedByHandIntoSomethingThatCannotBeBuilt(
  app: ModifiableApp,
): Promise<void> {
  await Bun.write(join(app.dataDir, "ui", "src", "session-table.ts"), UNREADABLE_SOURCE);
}

/**
 * A released app where a cost column change passed the checks and waits for Keep, and the live UI
 * was then edited by hand into something no build can read.
 */
export async function aCostChangeWaitsForKeepAndTheLiveUiWasBrokenByHand(): Promise<ModifiableApp> {
  const app = await startsAppLikeARelease();
  app.mockAgent.willWriteFile("src/session-table.ts", sessionTableWith("Title", "Status", "Cost"));
  await app.user.asksToModifyTheUi("add a cost column");
  await expectUiChangeReadyToKeep(app);
  await theLiveUiIsEditedByHandIntoSomethingThatCannotBeBuilt(app);
  return app;
}

/** A released app where the user kept a cost column, and default UI 1.1 (a new footer) came out. */
export async function aCostColumnWasKeptAndDefaultUiOnePointOneIsReleased(): Promise<ModifiableApp> {
  const app = await startsAppLikeARelease();
  await userKeptTableColumns(app, ["Title", "Status", "Cost"]);
  const footer = { "src/footer.ts": 'export const footer = "AgentControl 1.1";\n' };
  await releaseDefaultUiUpdate(app, { version: "1.1", files: footer });
  return app;
}
