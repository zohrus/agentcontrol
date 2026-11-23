import { afterEach, expect, test } from "bun:test";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startsSecondAppOnTheSamePort } from "../support/setup/second-app.ts";
import { startAppWithLocalWorkspace } from "../support/setup/start-app.ts";

afterEach(cleanUpAfterTest);

test("starting AgentControl on a port that is taken says so and suggests another port", async () => {
  // ********************************************************************
  // ** GIVEN AgentControl is already running on its port
  // ********************************************************************
  const app = await startAppWithLocalWorkspace();

  // ********************************************************************
  // ** WHEN a second copy is started on the same port
  // ********************************************************************
  const message = await startsSecondAppOnTheSamePort(app.baseUrl);

  // ********************************************************************
  // ** THEN it says the port is in use and suggests `bun dev --port`
  // ********************************************************************
  const port = new URL(app.baseUrl).port;
  expect(message).toContain(`Port ${port} is already in use`);
  expect(message).toContain("bun dev --port");
});
