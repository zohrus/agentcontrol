import { configUserOf } from "../setup/config-user.ts";
import { command, mcpServer, onlyInRepo } from "../setup/config-items.ts";
import { createLocalRepo } from "../setup/local-repo.ts";
import { expectConfigToShow } from "./config-browser-expectations.ts";
import type { BrowserOptions } from "./start-app-in-browser.ts";
import { startConfigAppInBrowser, type ConfigAppInBrowser } from "./start-config-app-in-browser.ts";

/** An MCP server "docs" that was set up and applied before the user opens Config. */
export async function startConfigAppWithAnAppliedServer(): Promise<ConfigAppInBrowser> {
  const app = await startConfigAppInBrowser();
  const user = configUserOf({ sdk: app.sdk, repoPath: app.repoPath });
  await user.setsUp([mcpServer({ name: "docs", command: "npx" })]);
  await user.reviewsAndAppliesThePlan();
  return app;
}

/** A slash command "ship" is set up, which Claude Code can take and Codex cannot. */
export async function startConfigAppWithACommand(): Promise<ConfigAppInBrowser> {
  const app = await startConfigAppInBrowser();
  const user = configUserOf({ sdk: app.sdk, repoPath: app.repoPath });
  await user.setsUp([command({ name: "ship", prompt: "Ship it." })]);
  return app;
}

const CLAUDE_SERVER =
  '{ "mcpServers": { "fs": { "command": "npx", "args": ["-y", "server-fs"] } } }\n';
const CODEX_SERVER = '[mcp_servers.fs]\ncommand = "npx"\n';

/** Both agents already have an MCP server "fs", written by hand before AgentControl. */
export function startConfigAppWithAnExistingSetup(): Promise<ConfigAppInBrowser> {
  return startConfigAppInBrowser({
    ".claude.json": CLAUDE_SERVER,
    ".codex/config.toml": CODEX_SERVER,
  });
}

/** The user opened Config and added an MCP server "docs" there; nothing is reviewed yet. */
export async function startConfigAppWithAServerAddedInTheScreen(
  options: BrowserOptions = {},
): Promise<ConfigAppInBrowser> {
  const app = await startConfigAppInBrowser({}, options);
  await app.page.opensConfig();
  await app.page.addsMcpServer({ name: "docs", command: "npx" });
  await expectConfigToShow(app, "docs");
  return app;
}

/** The user added an MCP server "docs" in the Config screen, reviewed the changes and applied them. */
export async function startConfigAppAfterApplyingAServerInTheScreen(
  options: BrowserOptions = {},
): Promise<ConfigAppInBrowser> {
  const app = await startConfigAppWithAServerAddedInTheScreen(options);
  await app.page.reviewsTheChanges();
  await app.page.appliesTheChanges();
  await expectConfigToShow(app, "Applied.");
  return app;
}

/** An applied MCP server "docs" that the user then edited by hand in Claude Code's file. */
export async function startConfigAppWithAServerEditedByHand(): Promise<ConfigAppInBrowser> {
  const app = await startConfigAppWithAnAppliedServer();
  await app.home.edits(".claude.json", { replace: '"npx"', with: '"node"' });
  return app;
}

/** An MCP server "docs" is set up in the app but not applied. */
export async function startConfigAppWithAServer(): Promise<ConfigAppInBrowser> {
  const app = await startConfigAppInBrowser();
  const user = configUserOf({ sdk: app.sdk, repoPath: app.repoPath });
  await user.setsUp([mcpServer({ name: "docs", command: "npx" })]);
  return app;
}

/** An MCP server "api" whose token is a secret that is not stored anywhere yet. */
export async function startConfigAppWithAServerThatNeedsASecret(): Promise<ConfigAppInBrowser> {
  const app = await startConfigAppInBrowser();
  const user = configUserOf({ sdk: app.sdk, repoPath: app.repoPath });
  const env = { TOKEN: "${secret:API_TOKEN}" };
  await user.setsUp([mcpServer({ name: "api", command: "npx", env })]);
  return app;
}

/** The app knows the local repository, and the page has loaded it. */
export async function startConfigAppKnowingTheRepository(): Promise<ConfigAppInBrowser> {
  const app = await startConfigAppInBrowser();
  await app.user.addsTheRepo();
  await app.page.reloads();
  return app;
}

/** Items for everywhere, for the app's repository and for a second repository; nothing applied. */
export async function startConfigAppWithItemsInTwoRepositoriesAndEverywhere() {
  const app = await startConfigAppInBrowser();
  const user = configUserOf({ sdk: app.sdk, repoPath: app.repoPath });
  const secondRepo = await createLocalRepo();
  await user.setsUp([
    mcpServer({ name: "docs", command: "npx" }),
    onlyInRepo(mcpServer({ name: "ui", command: "npx" }), app.repoPath),
    onlyInRepo(mcpServer({ name: "api", command: "npx" }), secondRepo),
  ]);
  return Object.assign(app, { secondRepo });
}
