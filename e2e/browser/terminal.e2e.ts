import { afterEach, test } from "bun:test";
import {
  expectTerminalToShowAPrompt,
  expectTerminalToExplainItEnded,
  expectTerminalToShowLine,
} from "../support/browser/terminal-expectations.ts";
import { opensAFinishedSession } from "../support/browser/terminal-setups.ts";
import { BROWSER_TEST_TIMEOUT_MS } from "../support/browser/start-app-in-browser.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";

afterEach(cleanUpAfterTest);

test(
  "the Terminal tab shows a prompt and the output of a typed command",
  async () => {
    // ********************************************************************
    // ** GIVEN a finished session open in the browser
    // ********************************************************************
    const { app } = await opensAFinishedSession();

    // ********************************************************************
    // ** WHEN the user opens the Terminal tab and types `echo hello`
    // ********************************************************************
    await app.page.opensTerminalTab();
    await expectTerminalToShowAPrompt(app);
    await app.page.typesInTerminal("echo hello");

    // ********************************************************************
    // ** THEN the terminal shows hello
    // ********************************************************************
    await expectTerminalToShowLine(app, "hello");
  },
  BROWSER_TEST_TIMEOUT_MS,
);

test(
  "the terminal follows the window's size: the shell sees the new number of rows",
  async () => {
    // ********************************************************************
    // ** GIVEN the Terminal tab open, and the size the shell sees recorded
    // ********************************************************************
    const { app } = await opensAFinishedSession();
    await app.page.opensTerminalTab();
    await expectTerminalToShowAPrompt(app);
    await app.page.typesInTerminal("echo before=$(stty size | tr ' ' x)");
    const before = await expectTerminalToShowLine(app, "before=\\d+x\\d+");

    // ********************************************************************
    // ** WHEN the window gets 300 pixels shorter
    // ********************************************************************
    await app.page.resizesTheWindow({ width: 1280, height: 420 });

    // ********************************************************************
    // ** THEN the shell sees fewer rows, and the output is not garbled
    // ********************************************************************
    await app.page.typesInTerminal("echo after=$(stty size | tr ' ' x)");
    const after = await expectTerminalToShowLine(app, "after=\\d+x\\d+");
    expectFewerRows({ before, after });
  },
  BROWSER_TEST_TIMEOUT_MS,
);

function expectFewerRows(sizes: { before: string; after: string }): void {
  const rowsOf = (text: string): number => Number(/=(\d+)x/.exec(text)?.[1]);
  if (!(rowsOf(sizes.after) < rowsOf(sizes.before))) {
    throw new Error(
      `expected the shell to see fewer rows after the window got shorter, but it saw ${sizes.before} before and ${sizes.after} after`,
    );
  }
}

test(
  "switching to another tab and back keeps the session's shell running",
  async () => {
    // ********************************************************************
    // ** GIVEN the Terminal tab open, with the shell's process id shown
    // ********************************************************************
    const { app } = await opensAFinishedSession();
    await app.page.opensTerminalTab();
    await expectTerminalToShowAPrompt(app);
    await app.page.typesInTerminal("echo first=$$");
    const first = await expectTerminalToShowLine(app, "first=\\d+");

    // ********************************************************************
    // ** WHEN the user opens the Changes tab and comes back to the Terminal tab
    // ********************************************************************
    await app.page.opensChangesTab();
    await app.page.opensTerminalTab();
    await app.page.typesInTerminal("echo second=$$");

    // ********************************************************************
    // ** THEN it is the same shell
    // ********************************************************************
    const second = await expectTerminalToShowLine(app, "second=\\d+");
    expectSameShell({ first, second });
  },
  BROWSER_TEST_TIMEOUT_MS,
);

function expectSameShell(pids: { first: string; second: string }): void {
  const [first, second] = [pids.first.split("=")[1], pids.second.split("=")[1]];
  if (first !== second) {
    throw new Error(
      `expected the same shell after switching tabs, but its id went from ${first ?? ""} to ${second ?? ""}`,
    );
  }
}

test(
  "when the shell has ended, New terminal starts a fresh one",
  async () => {
    // ********************************************************************
    // ** GIVEN the Terminal tab open, and the user has typed `exit 2`
    // ********************************************************************
    const { app } = await opensAFinishedSession();
    await app.page.opensTerminalTab();
    await expectTerminalToShowAPrompt(app);
    await app.page.typesInTerminal("exit 2");
    await expectTerminalToExplainItEnded(app, "exit code 2");

    // ********************************************************************
    // ** WHEN the user presses New terminal and types `echo again`
    // ********************************************************************
    await app.page.startsANewTerminal();
    await expectTerminalToShowAPrompt(app);
    await app.page.typesInTerminal("echo again");

    // ********************************************************************
    // ** THEN the new shell prints again
    // ********************************************************************
    await expectTerminalToShowLine(app, "again");
  },
  BROWSER_TEST_TIMEOUT_MS,
);
