import type { OpenShell } from "../setup/terminal-user.ts";
import type { Timeline } from "../setup/timeline.ts";

/** The terminal says in plain words that the page's secret is out of date and it should be reloaded. */
export async function expectTheTerminalToSayTheSecretIsOutOfDate(shell: OpenShell): Promise<void> {
  await shell.problems.waitFor(
    (problem) => /secret is out of date.*Reload the page/.test(problem),
    "expected the terminal to say the page's secret is out of date and to reload it",
  );
}

/** The page was told the app refused its secret, which is what makes it reload itself. */
export async function expectThePageToHaveBeenToldToReload(refusals: Timeline<number>) {
  await refusals.waitFor(() => true, "expected the app to refuse the page's secret");
}

/** The terminal says what it said before: it could not connect, and why that may be. */
export async function expectTheTerminalToSayItCouldNotConnect(shell: OpenShell): Promise<void> {
  await shell.problems.waitFor(
    (problem) => problem.startsWith("The terminal could not connect."),
    "expected the terminal to say it could not connect",
  );
}
