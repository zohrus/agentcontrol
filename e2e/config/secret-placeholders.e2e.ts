import { afterEach, test } from "bun:test";
import { expectPlanToNeedSecret } from "../support/expect/config-expectations.ts";
import { cleanUpAfterTest } from "../support/setup/cleanup.ts";
import { startAppWithEmptyHome } from "../support/setup/config-app.ts";
import { afterEditHook, mcpServer } from "../support/setup/config-items.ts";

afterEach(cleanUpAfterTest);

test("secret placeholders in a server's url, its arguments and a hook's command are listed in the plan", async () => {
  // ********************************************************************
  // ** GIVEN a remote server with a secret in its url, a local one with one in its arguments
  // ********************************************************************
  const app = await startAppWithEmptyHome();
  await app.user.setsUp([
    mcpServer({ name: "remote", url: "https://example.com/${secret:URL_KEY}/mcp" }),
    mcpServer({ name: "local", command: "npx", args: ["--token", "${secret:ARG_TOKEN}"] }),
    // AND a hook whose command uses a secret
    afterEditHook({ id: "notify", command: "notify --key ${secret:HOOK_KEY}" }),
  ]);

  // ********************************************************************
  // ** WHEN the user reviews the plan
  // ********************************************************************
  const plan = await app.user.reviewsThePlan();

  // ********************************************************************
  // ** THEN the plan says each of them needs its secret
  // ********************************************************************
  expectPlanToNeedSecret(plan, { itemId: "mcp-remote", secret: "URL_KEY" });
  expectPlanToNeedSecret(plan, { itemId: "mcp-local", secret: "ARG_TOKEN" });
  expectPlanToNeedSecret(plan, { itemId: "notify", secret: "HOOK_KEY" });
});
