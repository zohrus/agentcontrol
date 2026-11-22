import { afterEach, test } from "bun:test";
import { expectSessionWaitingForReply } from "../support/expect/app-expectations.ts";
import { expectAppToRefuse } from "../support/expect/app-refusal-expectations.ts";
import {
  expectHostAliasesToBe,
  expectPastSessionToStayReadable,
  expectRefusalToSay,
  expectWorkspaceListedAs,
} from "../support/expect/ssh-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithSshHost } from "../support/setup/start-app-with-ssh-host.ts";

afterEach(cleanUpAfterTest);

test("removing a workspace keeps its past sessions readable and refuses new messages", async () => {
  // ********************************************************************
  // ** GIVEN a finished session on an ssh workspace
  // ********************************************************************
  const { app, host, user } = await startAppWithSshHost();
  const workspace = await user.addsTheHost();
  host.mockAgent.willReply("Done on the host");
  const session = await user.startsSessionOn(workspace, { prompt: "Do it on the host" });
  await expectSessionWaitingForReply(app, session);

  // ********************************************************************
  // ** WHEN the user removes the workspace
  // ********************************************************************
  await user.removesTheWorkspace(workspace);

  // ********************************************************************
  // ** THEN the workspace is listed as removed
  // ********************************************************************
  await expectWorkspaceListedAs(app, { workspace, state: "removed" });
  // AND the session is still listed under it, with its history
  await expectPastSessionToStayReadable(app, { session, workspace });
  // AND a new message to the session is refused, saying the workspace was removed
  const refused = await user.triesToSendMessage(session, "Are you there?");
  expectAppToRefuse(refused, { status: 409, code: "workspace-removed" });
  expectRefusalToSay(refused, "was removed");
});

test("This Mac cannot be removed", async () => {
  // ********************************************************************
  // ** GIVEN the app is running with its local workspace
  // ********************************************************************
  const { user } = await startAppWithSshHost();

  // ********************************************************************
  // ** WHEN the user tries to remove This Mac
  // ********************************************************************
  const outcome = await user.triesToRemove("local");

  // ********************************************************************
  // ** THEN the app refuses
  // ********************************************************************
  expectAppToRefuse(outcome, { status: 409, code: "local-workspace" });
});

test("a host name that could be read as an ssh option is refused", async () => {
  // ********************************************************************
  // ** GIVEN the app is running
  // ********************************************************************
  const { user } = await startAppWithSshHost();

  // ********************************************************************
  // ** WHEN the user adds a host called "-oProxyCommand=touch /tmp/x"
  // ********************************************************************
  const outcome = await user.triesToAdd("-oProxyCommand=touch /tmp/x");

  // ********************************************************************
  // ** THEN the app refuses it as invalid
  // ********************************************************************
  expectAppToRefuse(outcome, { status: 400, code: "invalid-request" });
});

test("a host that is already a workspace cannot be added twice", async () => {
  // ********************************************************************
  // ** GIVEN a host that was added as a workspace
  // ********************************************************************
  const { host, user } = await startAppWithSshHost();
  await user.addsTheHost();

  // ********************************************************************
  // ** WHEN the user adds the same host again
  // ********************************************************************
  const outcome = await user.triesToAdd(host.alias);

  // ********************************************************************
  // ** THEN the app refuses it as a duplicate
  // ********************************************************************
  expectAppToRefuse(outcome, { status: 409, code: "workspace-exists" });
});

test("the host names offered for adding are the ones in the ssh config, without patterns", async () => {
  // ********************************************************************
  // ** GIVEN an ssh config with one host and one wildcard pattern
  // ********************************************************************
  const { host, user } = await startAppWithSshHost();

  // ********************************************************************
  // ** WHEN the user opens "Add workspace"
  // ********************************************************************
  const aliases = await user.readsTheHostAliases();

  // ********************************************************************
  // ** THEN only the host is offered
  // ********************************************************************
  expectHostAliasesToBe(aliases, [host.alias]);
});
