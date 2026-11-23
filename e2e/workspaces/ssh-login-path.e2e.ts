import { afterEach, setDefaultTimeout, test } from "bun:test";
import { expectChecklistToPass } from "../support/expect/ssh-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithSshHost } from "../support/setup/start-app-with-ssh-host.ts";

// Every ssh call is a real handshake, and the suite runs files side by side.
setDefaultTimeout(60_000);
afterEach(cleanUpAfterTest);

test("the host's relay finds an agent that is only on the login shell's PATH", async () => {
  // ********************************************************************
  // ** GIVEN a host where Claude Code is only on the PATH of the user's login shell
  // ********************************************************************
  const { user } = await startAppWithSshHost({ agentOnLoginPathOnly: true });
  const workspace = await user.addsTheHost();

  // ********************************************************************
  // ** WHEN the user runs the workspace check
  // ********************************************************************
  const steps = await user.checksTheWorkspace(workspace);

  // ********************************************************************
  // ** THEN the checklist says Claude Code starts and answers
  // ********************************************************************
  expectChecklistToPass(steps, ["agent-claude-code"]);
});
