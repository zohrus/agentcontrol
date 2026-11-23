import { afterEach, setDefaultTimeout, test } from "bun:test";
import {
  expectForwardingToFail,
  expectGreetingToBe,
} from "../support/expect/ssh-host-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  connectsAndReadsGreeting,
  forwardsPortOfHost,
  startDevServerOnHost,
  triesToForwardPortOfHost,
} from "../support/setup/ssh-forwarding.ts";
import { startSshHost } from "../support/setup/ssh-host.ts";

// Every ssh call is a real handshake, and the suite runs files side by side.
setDefaultTimeout(60_000);
afterEach(cleanUpAfterTest);

test("a port of a dev server on the host can be reached from this machine", async () => {
  // ********************************************************************
  // ** GIVEN a dev server listening on a port of the host
  // ********************************************************************
  const host = await startSshHost();
  const devServer = startDevServerOnHost();

  // ********************************************************************
  // ** WHEN the app forwards that port over ssh
  // ********************************************************************
  const forwarded = await forwardsPortOfHost(host, devServer.port);

  // ********************************************************************
  // ** THEN connecting to the forwarded port on this machine reaches the dev server
  // ********************************************************************
  expectGreetingToBe(await connectsAndReadsGreeting(forwarded.localPort), devServer.greeting);
});

test("forwarding a port of a host that cannot be reached fails with the reason", async () => {
  // ********************************************************************
  // ** GIVEN a host that cannot be reached over the network
  // ********************************************************************
  const host = await startSshHost();
  host.network.goesDown();

  // ********************************************************************
  // ** WHEN the app tries to forward a port of the host
  // ********************************************************************
  const outcome = await triesToForwardPortOfHost(host, 3000);

  // ********************************************************************
  // ** THEN forwarding fails
  // ********************************************************************
  expectForwardingToFail(outcome, "could not be forwarded");
});
