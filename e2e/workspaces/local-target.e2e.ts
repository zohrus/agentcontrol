import { afterEach, test } from "bun:test";
import {
  expectDescriptionOfThisMachine,
  expectNothingToInstallOrForward,
  expectRelayToBeRunning,
  expectRelayToHaveStopped,
  expectRelayToStillBeRunning,
} from "../support/expect/local-target-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import {
  asksForInstallAndForward,
  asksTheRelayStartedByTheTarget,
  startsLocalTarget,
} from "../support/setup/local-target.ts";

afterEach(cleanUpAfterTest);

test("the relay bridge command of the local target starts the relay of this machine", async () => {
  // ********************************************************************
  // ** GIVEN the local target of this machine
  // ********************************************************************
  const { target, dataDir } = await startsLocalTarget();

  // ********************************************************************
  // ** WHEN the app runs the target's bridge command and asks the relay for its agents
  // ********************************************************************
  const agents = await asksTheRelayStartedByTheTarget(target);

  // ********************************************************************
  // ** THEN the relay answers and keeps running
  // ********************************************************************
  expectRelayToBeRunning(agents);
  await expectRelayToStillBeRunning(dataDir);
});

test("stopping the relay through the local target ends it", async () => {
  // ********************************************************************
  // ** GIVEN a relay started through the local target
  // ********************************************************************
  const { target, dataDir } = await startsLocalTarget();
  await asksTheRelayStartedByTheTarget(target);

  // ********************************************************************
  // ** WHEN the target stops the relay
  // ********************************************************************
  await target.stopRelay();

  // ********************************************************************
  // ** THEN the relay is gone
  // ********************************************************************
  await expectRelayToHaveStopped(dataDir);
});

test("the local target describes this machine", async () => {
  // ********************************************************************
  // ** GIVEN the local target of this machine
  // ********************************************************************
  const { target } = await startsLocalTarget();

  // ********************************************************************
  // ** WHEN the app inspects it
  // ********************************************************************
  const machine = await target.inspect();

  // ********************************************************************
  // ** THEN it names this operating system and CPU and its free disk space
  // ********************************************************************
  expectDescriptionOfThisMachine(machine);
});

test("on this machine there is nothing to install and no port to forward over ssh", async () => {
  // ********************************************************************
  // ** GIVEN the local target of this machine
  // ********************************************************************
  const { target } = await startsLocalTarget();

  // ********************************************************************
  // ** WHEN the app asks to install the relay and to forward a port
  // ********************************************************************
  const outcome = await asksForInstallAndForward(target);

  // ********************************************************************
  // ** THEN nothing is installed, the relay counts as in place and the port is the same one
  // ********************************************************************
  expectNothingToInstallOrForward(outcome);
});
