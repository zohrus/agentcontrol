import { afterEach, test } from "bun:test";
import {
  expectAgentOffered,
  expectChecklistStepToPass,
  expectRepoListed,
} from "../support/expect/app-workspace-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("a repo the user adds is listed with the default worktree setup", async () => {
  // ********************************************************************
  // ** GIVEN a running app and a local git repo
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN the user adds the repo
  // ********************************************************************
  await app.user.addsTheRepo();

  // ********************************************************************
  // ** THEN the repo is listed and has no setup script
  // ********************************************************************
  expectRepoListed(app, { repos: await app.user.listsTheRepos() });
});

test("the setup script the user sets for a repo is kept with it", async () => {
  // ********************************************************************
  // ** GIVEN a running app and a local git repo
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN the user sets the repo's setup script to `bun install`
  // ********************************************************************
  await app.user.setsTheRepoSetupScript("bun install");

  // ********************************************************************
  // ** THEN the repo is listed with that setup script
  // ********************************************************************
  expectRepoListed(app, { repos: await app.user.listsTheRepos(), setupScript: "bun install" });
});

test("the workspace offers the agents it can run", async () => {
  // ********************************************************************
  // ** GIVEN a running app whose relay can run the mock agent
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN the user asks which agents are available
  // ********************************************************************
  const agents = await app.user.listsTheAgents();

  // ********************************************************************
  // ** THEN the mock agent is offered
  // ********************************************************************
  expectAgentOffered(agents, "mock");
});

test("the setup checklist shows that git is installed", async () => {
  // ********************************************************************
  // ** GIVEN a running app
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN the user opens the setup checklist
  // ********************************************************************
  const steps = await app.user.readsTheChecklist();

  // ********************************************************************
  // ** THEN the git step passed
  // ********************************************************************
  expectChecklistStepToPass(steps, "git");
});
