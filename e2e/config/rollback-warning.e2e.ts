import { afterEach, test } from "bun:test";
import {
  expectFileToContain,
  expectNoFile,
  expectSameFiles,
} from "../support/expect/config-expectations.ts";
import { expectRollbackToWarnAbout } from "../support/expect/rollback-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithAnAppliedServerOverTheUsersFile } from "../support/setup/applied-config.ts";
import { startAppWithEmptyHome } from "../support/setup/config-app.ts";
import { mcpServer } from "../support/setup/config-items.ts";

afterEach(cleanUpAfterTest);

const editedLater = '{ "numStartups": 3 }\n';

test("a rollback lists the files changed after the apply and restores nothing", async () => {
  // ********************************************************************
  // ** GIVEN an applied MCP server, after which Claude Code rewrote its own file
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  await app.user.setsUp([mcpServer({ name: "search", command: "bunx" })]);
  const applied = await app.user.reviewsAndAppliesThePlan();
  await app.home.has(".claude.json", editedLater);

  // ********************************************************************
  // ** WHEN the user rolls the apply back without confirming
  // ********************************************************************
  const outcome = await app.user.rollsBack(applied);

  // ********************************************************************
  // ** THEN the rollback names .claude.json and restores nothing
  // ********************************************************************
  expectRollbackToWarnAbout(outcome, ".claude.json");
  await expectFileToContain(app.home, { file: ".claude.json", text: "numStartups" });
  await expectFileToContain(app.home, { file: ".codex/config.toml", text: "search" });
});

test("a confirmed rollback overwrites the files changed after the apply", async () => {
  // ********************************************************************
  // ** GIVEN a home with a file the user wrote, an applied MCP server and a later edit
  // ********************************************************************
  const { app, filesBefore, applied } = await startAppWithAnAppliedServerOverTheUsersFile();
  await app.home.has(".claude.json", editedLater);

  // ********************************************************************
  // ** WHEN the user rolls back and confirms
  // ********************************************************************
  await app.user.rollsBackAnyway(applied);

  // ********************************************************************
  // ** THEN every file is as it was before the apply
  // ********************************************************************
  expectSameFiles({ before: filesBefore, after: await app.home.snapshot() });
  await expectNoFile(app.home, ".codex/config.toml");
});
