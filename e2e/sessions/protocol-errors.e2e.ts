import { afterEach, test } from "bun:test";
import { ErrorCode } from "@agentcontrol/protocol";
import {
  expectLineToBeAnsweredWithError,
  expectRefusal,
  expectRefusalToBeAboutTheSchema,
  expectSecondRelayToBeRefused,
} from "../support/expect/refusal-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startRelayWithLocalRepo } from "../support/setup/start-relay.ts";

afterEach(cleanUpAfterTest);

test("a method the relay does not have is refused as not found", async () => {
  // ********************************************************************
  // ** GIVEN a running relay
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();

  // ********************************************************************
  // ** WHEN the app calls a method the relay does not have
  // ********************************************************************
  const outcome = await relay.user.triesToCallAMethodTheRelayDoesNotHave();

  // ********************************************************************
  // ** THEN the relay says the method is unknown
  // ********************************************************************
  expectRefusal(outcome, { code: ErrorCode.methodNotFound, saying: "relay/make-coffee" });
});

test("a call with missing parameters is refused as invalid", async () => {
  // ********************************************************************
  // ** GIVEN a running relay
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();

  // ********************************************************************
  // ** WHEN the app starts a session without saying where
  // ********************************************************************
  const outcome = await relay.user.triesToStartASessionWithoutSayingWhere();

  // ********************************************************************
  // ** THEN the relay refuses the parameters
  // ********************************************************************
  expectRefusal(outcome, { code: ErrorCode.invalidParams, saying: "repoPath" });
});

test("a call with parameters that do not fit the schema is marked as a schema refusal", async () => {
  // ********************************************************************
  // ** GIVEN a running relay
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();

  // ********************************************************************
  // ** WHEN the app starts a session without saying where
  // ********************************************************************
  const outcome = await relay.user.triesToStartASessionWithoutSayingWhere();

  // ********************************************************************
  // ** THEN the refusal says it is about the schema, not about what was asked
  // ********************************************************************
  expectRefusalToBeAboutTheSchema(outcome);
});

test("a line that is not JSON is answered with a parse error", async () => {
  // ********************************************************************
  // ** GIVEN a running relay
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();

  // ********************************************************************
  // ** WHEN the app sends a line that is not JSON
  // ********************************************************************
  relay.user.sendsALineThatIsNotJson();

  // ********************************************************************
  // ** THEN the relay answers with a parse error
  // ********************************************************************
  await expectLineToBeAnsweredWithError(relay, ErrorCode.parseError);
});

test("a message that is not a request is answered with an invalid-request error", async () => {
  // ********************************************************************
  // ** GIVEN a running relay
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();

  // ********************************************************************
  // ** WHEN the app sends JSON that has no method
  // ********************************************************************
  relay.user.sendsAMessageThatIsNotARequest();

  // ********************************************************************
  // ** THEN the relay answers that it is not a valid request
  // ********************************************************************
  await expectLineToBeAnsweredWithError(relay, ErrorCode.invalidRequest);
});

test("adding a folder that is not a git repository is refused", async () => {
  // ********************************************************************
  // ** GIVEN a running relay
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();

  // ********************************************************************
  // ** WHEN the user adds a folder that is not a git repository
  // ********************************************************************
  const outcome = await relay.user.triesToAddRepo(relay.dataDir);

  // ********************************************************************
  // ** THEN the relay says it is not a git repository
  // ********************************************************************
  expectRefusal(outcome, { code: ErrorCode.internalError, saying: "is not a git repository" });
});

test("setting up a repo that is not registered is refused", async () => {
  // ********************************************************************
  // ** GIVEN a running relay
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();

  // ********************************************************************
  // ** WHEN the user sets the worktree setup of a repo the relay does not know
  // ********************************************************************
  const outcome = await relay.user.triesToSetupARepoThatIsNotRegistered();

  // ********************************************************************
  // ** THEN the relay says that repo is not registered
  // ********************************************************************
  expectRefusal(outcome, { code: ErrorCode.internalError, saying: "not registered" });
});

test("a second relay on a folder that is already served is refused", async () => {
  // ********************************************************************
  // ** GIVEN a running relay
  // ********************************************************************
  const relay = await startRelayWithLocalRepo();

  // ********************************************************************
  // ** WHEN another relay is started on the same data folder
  // ********************************************************************
  const result = await relay.user.triesToStartASecondRelay();

  // ********************************************************************
  // ** THEN it is refused because one is already running
  // ********************************************************************
  expectSecondRelayToBeRefused(result);
});
