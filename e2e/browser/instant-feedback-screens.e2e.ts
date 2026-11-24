import { RelayName } from "@agentcontrol/protocol";
import { afterEach, test } from "bun:test";
import {
  startConfigAppAfterApplyingAServerInTheScreen,
  startConfigAppWithAServerAddedInTheScreen,
} from "../support/browser/config-setups.ts";
import { opensReadmeInTheEditor } from "../support/browser/more-session-setups.ts";
import { pageShows } from "../support/browser/reaction.ts";
import { expectPageToReactAtOnce } from "../support/browser/reaction-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { aRelayThatIsSlowToAnswer } from "../support/setup/slow-relay.ts";

afterEach(cleanUpAfterTest);

test(
  "saving a file in the editor says it is saving at once, while the relay has not answered",
  async () => {
    // ********************************************************************
    // ** GIVEN README.md open in the editor with an edit typed in, and a relay slow to write files
    // ********************************************************************
    const relay = aRelayThatIsSlowToAnswer(RelayName.fsWrite);
    const app = await startAppInBrowser({ relayWire: relay.wire });
    await opensReadmeInTheEditor(app);
    await app.page.replacesFileInTheEditor("my edit");

    // ********************************************************************
    // ** WHEN the user saves with the keyboard
    // ********************************************************************
    // ********************************************************************
    // ** THEN the editor says it is saving before the relay has written the file
    // ********************************************************************
    await expectPageToReactAtOnce(app, {
      action: "Save file",
      act: () => app.page.savesWithTheKeyboard(),
      shown: pageShows("Saving…"),
      reads: "say that the file is being saved",
      backEndAnswers: () => {
        relay.answers();
      },
    });
    relay.answers();
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "reviewing the configuration says so at once, while the relay has not made the plan",
  async () => {
    // ********************************************************************
    // ** GIVEN an MCP server added in the Config screen, and a relay slow to plan
    // ********************************************************************
    const relay = aRelayThatIsSlowToAnswer(RelayName.configPlan);
    const app = await startConfigAppWithAServerAddedInTheScreen({ relayWire: relay.wire });

    // ********************************************************************
    // ** WHEN the user presses Review changes
    // ********************************************************************
    // ********************************************************************
    // ** THEN the button says it is reviewing before the relay has made the plan
    // ********************************************************************
    await expectPageToReactAtOnce(app, {
      action: "Review changes",
      act: () => app.page.reviewsTheChanges(),
      shown: pageShows("Reviewing…"),
      reads: "say that the changes are being reviewed",
      backEndAnswers: () => {
        relay.answers();
      },
    });
    relay.answers();
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "applying and undoing the configuration say so at once, while the relay has not answered",
  async () => {
    // ********************************************************************
    // ** GIVEN a reviewed configuration, and a relay slow to apply and to roll back
    // ********************************************************************
    const relay = aRelayThatIsSlowToAnswer(RelayName.configApply, RelayName.configRollback);
    const app = await startConfigAppWithAServerAddedInTheScreen({ relayWire: relay.wire });
    await app.page.reviewsTheChanges();

    // ********************************************************************
    // ** WHEN the user presses Apply
    // ********************************************************************
    // ********************************************************************
    // ** THEN the button says it is applying before the relay has written the files
    // ********************************************************************
    await expectPageToReactAtOnce(app, {
      action: "Apply",
      act: () => app.page.appliesTheChanges(),
      shown: pageShows("Applying…"),
      reads: "say that the changes are being applied",
      backEndAnswers: () => {
        relay.answers();
      },
    });
    relay.answers();
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "undoing an apply says so at once, while the relay has not put the files back",
  async () => {
    // ********************************************************************
    // ** GIVEN an applied configuration, and a relay slow to roll back
    // ********************************************************************
    const relay = aRelayThatIsSlowToAnswer(RelayName.configRollback);
    const app = await startConfigAppAfterApplyingAServerInTheScreen({ relayWire: relay.wire });

    // ********************************************************************
    // ** WHEN the user presses Undo this apply
    // ********************************************************************
    // ********************************************************************
    // ** THEN the button says it is undoing before the relay has put the files back
    // ********************************************************************
    await expectPageToReactAtOnce(app, {
      action: "Undo this apply",
      act: () => app.page.undoesTheApply(),
      shown: pageShows("Undoing…"),
      reads: "say that the apply is being undone",
      backEndAnswers: () => {
        relay.answers();
      },
    });
    relay.answers();
  },
  BROWSER_TEST_TIMEOUT_MS,
);
