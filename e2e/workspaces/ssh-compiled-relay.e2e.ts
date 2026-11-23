import { afterEach, setDefaultTimeout, test } from "bun:test";
import { expectRelayInstalledOnHost } from "../support/expect/ssh-host-expectations.ts";
import { expectWorkspaceToBe } from "../support/expect/ssh-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { compileRelayForThisMachine } from "../support/setup/compiled-relay.ts";
import { startAppWithSshHost } from "../support/setup/start-app-with-ssh-host.ts";

// Every ssh call is a real handshake, and the suite runs files side by side.
setDefaultTimeout(60_000);
afterEach(cleanUpAfterTest);

const compiled = compileRelayForThisMachine();

test.skipIf(compiled === undefined)(
  "a compiled relay binary is installed over ssh, starts its own daemon on the host and connects",
  async () => {
    // ********************************************************************
    // ** GIVEN the app has a compiled relay binary to install on a host
    // ********************************************************************
    const { host, user } = await startAppWithSshHost({ relayBinary: compiled ?? "" });

    // ********************************************************************
    // ** WHEN the user adds the host as a workspace
    // ********************************************************************
    const workspace = await user.addsTheHost();

    // ********************************************************************
    // ** THEN the workspace is connected
    // ********************************************************************
    expectWorkspaceToBe(workspace, "connected");
    // AND the compiled binary is the relay installed on the host
    await expectRelayInstalledOnHost(host);
  },
);
