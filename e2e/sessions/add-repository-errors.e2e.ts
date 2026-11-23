import { afterEach, test } from "bun:test";
import { ErrorCode } from "@agentcontrol/protocol";
import { expectRefusal } from "../support/expect/refusal-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("adding a folder that does not exist says it is not a folder on this computer", async () => {
  // ********************************************************************
  // ** GIVEN a running relay
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();

  // ********************************************************************
  // ** WHEN the user adds a path that does not exist
  // ********************************************************************
  const outcome = await relay.user.triesToAddRepo("/no/such/folder");

  // ********************************************************************
  // ** THEN the refusal is in plain words, without a system error code
  // ********************************************************************
  expectRefusal(outcome, {
    code: ErrorCode.internalError,
    saying: '"/no/such/folder" is not a folder on this computer',
  });
});

test("adding a file instead of a folder says it is not a folder on this computer", async () => {
  // ********************************************************************
  // ** GIVEN a running relay
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();

  // ********************************************************************
  // ** WHEN the user adds a path that is a file
  // ********************************************************************
  const file = `${relay.repoPath}/.git/HEAD`;
  const outcome = await relay.user.triesToAddRepo(file);

  // ********************************************************************
  // ** THEN the refusal is in plain words
  // ********************************************************************
  expectRefusal(outcome, { code: ErrorCode.internalError, saying: "is not a folder" });
});
