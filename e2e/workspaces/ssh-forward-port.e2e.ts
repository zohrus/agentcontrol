import { afterEach, test } from "bun:test";
import { expectGreetingToBe } from "../support/expect/ssh-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  connectsAndReadsGreeting,
  forwardsPortOfHost,
  startDevServerOnHost,
} from "../support/setup/ssh-forwarding.ts";
import { startSshHost } from "../support/setup/ssh-host.ts";

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
