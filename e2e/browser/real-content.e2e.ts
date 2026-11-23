import { afterEach, test } from "bun:test";
import { expectStreamToShow } from "../support/browser/browser-expectations.ts";
import { expectStreamNotToShow } from "../support/browser/rendering-expectations.ts";
import {
  BROWSER_TEST_TIMEOUT_MS,
  startAppInBrowser,
} from "../support/browser/start-app-in-browser.ts";
import { expectSessionWaitingForApproval } from "../support/expect/app-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "a reply written in markdown is shown formatted, without its markup",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser
    // ********************************************************************
    const app = await startAppInBrowser();
    // AND the agent will reply with a heading, a bullet and a code block
    app.mockAgent.willReply(
      "## Greeting updated\n\n- the **greeting** changed\n\n```js\nconst a = 1;\n```",
    );

    // ********************************************************************
    // ** WHEN the user starts a session and opens it
    // ********************************************************************
    const session = await app.user.startsSession({ prompt: "Change the greeting" });
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** THEN the conversation shows the heading and the code
    // ********************************************************************
    await expectStreamToShow(app, "Greeting updated");
    await expectStreamToShow(app, "const a = 1;");
    // AND none of the markdown markers
    await expectStreamNotToShow(app, "##");
    await expectStreamNotToShow(app, "**");
    await expectStreamNotToShow(app, "```");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "a request to change a file shows the lines it would add before the user answers",
  async () => {
    // ********************************************************************
    // ** GIVEN the app is open in a browser
    // ********************************************************************
    const app = await startAppInBrowser();
    // AND the agent will ask to write a file
    app.mockAgent.willWriteFile("src/server.ts", "export const port = 4000;\n");

    // ********************************************************************
    // ** WHEN the user starts a session and opens it while it waits for approval
    // ********************************************************************
    const session = await app.user.startsSession({ prompt: "Add a server" });
    await expectSessionWaitingForApproval(app, session);
    await app.page.opensSession(session.title);

    // ********************************************************************
    // ** THEN the request shows the file and the line the agent would write
    // ********************************************************************
    await expectStreamToShow(app, "src/server.ts");
    await expectStreamToShow(app, "export const port = 4000;");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
