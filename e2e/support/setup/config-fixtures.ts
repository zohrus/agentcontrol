import { folderAt, startAppWithEmptyHome, type ConfigApp } from "./config-app.ts";
import { createLocalRepo } from "./local-repo.ts";
import {
  afterEditHook,
  beforeToolHook,
  command,
  environment,
  instructions,
  mcpServer,
  onlyInRepo,
  permissionRule,
  skill,
} from "./config-items.ts";

const REVIEW_SKILL = "---\nname: review\ndescription: Review code\n---\nBe careful.\n";
const CLAUDE_BY_HAND =
  '{\n  "theme": "dark",\n  "mcpServers": {\n    "mine": { "command": "my-server" }\n  }\n}\n';
const CODEX_BY_HAND =
  '# my codex settings\nmodel = "gpt-5"\n\n[mcp_servers.mine]\ncommand = "my-server"\n';

/** A home folder where the user already wrote their own Claude Code and Codex settings and servers. */
export async function startAppWithHandWrittenAgentConfig(): Promise<ConfigApp> {
  const app = await startAppWithEmptyHome();
  await app.home.has(".claude.json", CLAUDE_BY_HAND);
  await app.home.has(".codex/config.toml", CODEX_BY_HAND);
  return app;
}

/** The app with a permission rule, a hook, a skill and a command set up. */
export async function startAppWithRuleHookSkillAndCommand(): Promise<ConfigApp> {
  const app = await startAppWithEmptyHome();
  await app.user.setsUp([
    permissionRule({ allow: ["Bash(git status:*)"], deny: ["Read(./.env)"] }),
    beforeToolHook({ id: "audit", command: "echo checking" }),
    skill({ name: "review", text: REVIEW_SKILL }),
    command({ name: "ship", prompt: "Ship it." }),
  ]);
  return app;
}

/** A home folder where the user hand-wrote both agents' config. */
export async function startAppWithHandWrittenSetupToImport(): Promise<ConfigApp> {
  const app = await startAppWithEmptyHome();
  const server = '{ "mcpServers": { "fs": { "command": "npx", "args": ["-y", "server-fs"] } } }\n';
  await app.home.has(".claude.json", server);
  await app.home.has(".claude/settings.json", '{ "permissions": { "allow": ["Bash(ls:*)"] } }\n');
  await app.home.has(".claude/CLAUDE.md", "Be kind to reviewers.\n");
  await app.home.has(".claude/commands/hello.md", "---\ndescription: Say hello\n---\nHi there\n");
  await app.home.has(".codex/config.toml", '[mcp_servers.fs]\ncommand = "npx"\n');
  return app;
}

/** Hand-written config, plus an MCP server, an instruction, a skill and a command the app applied. */
export async function startAppWithHandWrittenConfigAndAnAppliedSetup(): Promise<ConfigApp> {
  const app = await startAppWithHandWrittenAgentConfig();
  await app.user.setsUp([
    mcpServer({ name: "docs", command: "npx" }),
    instructions({ id: "team-rules", text: "Always write tests first." }),
    skill({ name: "review", text: REVIEW_SKILL }),
    command({ name: "ship", prompt: "Ship it." }),
  ]);
  await app.user.reviewsAndAppliesThePlan();
  return app;
}

/** Every kind of item the app knows, set up and applied. */
export async function startAppWithEveryKindOfItemApplied(): Promise<ConfigApp> {
  const app = await startAppWithEmptyHome();
  await app.user.setsUp([
    mcpServer({ name: "docs", command: "npx" }),
    instructions({ id: "team-rules", text: "Always write tests first." }),
    permissionRule({ allow: ["Bash(ls:*)"], deny: [], mode: "ask" }),
    beforeToolHook({ id: "audit", command: "echo checking" }),
    afterEditHook({ id: "format", command: "echo formatting" }),
    skill({ name: "review", text: REVIEW_SKILL }),
    command({ name: "ship", prompt: "Ship it.", description: "Ship the change" }),
    environment({ GREETING: "hello" }),
  ]);
  await app.user.reviewsAndAppliesThePlan();
  return app;
}

/** A home folder where the user hand-wrote Claude Code hooks, notes and an MCP server. */
export async function startAppWithHandWrittenHooksNotesAndServer(): Promise<ConfigApp> {
  const app = await startAppWithEmptyHome();
  const two = [
    { type: "command", command: "echo one" },
    { type: "command", command: "echo two" },
  ];
  const hooks = {
    Stop: [{ hooks: two }],
    PostToolUse: [{ hooks: [{ type: "command", command: "echo every-tool" }] }],
  };
  await app.home.has(".claude/settings.json", `${JSON.stringify({ hooks }, null, 2)}\n`);
  await app.home.has(".claude/CLAUDE.md", "Be kind to reviewers.\n\nUse tabs.\n");
  await app.home.has(
    ".claude.json",
    '{ "mcpServers": { "fs": { "args": ["-y", "fs"], "command": "npx" } } }\n',
  );
  return app;
}

/** An MCP server "docs" set up in the app and applied, with the plan and backup it produced. */
export async function startAppWithAnAppliedMcpServer() {
  const app = await startAppWithEmptyHome();
  await app.user.setsUp([mcpServer({ name: "docs", command: "npx" })]);
  const applied = await app.user.reviewsAndAppliesThePlan();
  return { app, applied };
}

/** An MCP server "docs" set up in the app and a plan for it that the user has reviewed but not applied. */
export async function startAppWithAReviewedPlan() {
  const app = await startAppWithEmptyHome();
  await app.user.setsUp([mcpServer({ name: "docs", command: "npx" })]);
  return { app, plan: await app.user.reviewsThePlan() };
}

/** Hand-written notes in CLAUDE.md with an instruction of the app's applied beside them. */
export async function startAppWithNotesBesideAnAppliedInstruction(): Promise<ConfigApp> {
  const app = await startAppWithEmptyHome();
  await app.home.has(".claude/CLAUDE.md", "Old notes.\n");
  await app.user.setsUp([instructions({ id: "team-rules", text: "Always write tests first." })]);
  await app.user.reviewsAndAppliesThePlan({ onlyForClaudeCode: true });
  return app;
}

/** An MCP server "docs" that the user set up for the one repository only. */
export async function startAppWithAServerForOneRepository(): Promise<ConfigApp> {
  const app = await startAppWithEmptyHome();
  await app.user.setsUp([onlyInRepo(mcpServer({ name: "docs", command: "npx" }), app.repo.path)]);
  return app;
}

/** Items for everywhere, for the app's repository and for a second repository. */
export async function startAppWithItemsInTwoRepositoriesAndEverywhere() {
  const app = await startAppWithEmptyHome();
  const second = folderAt(await createLocalRepo());
  await app.user.setsUp([
    mcpServer({ name: "docs", command: "npx" }),
    onlyInRepo(mcpServer({ name: "ui", command: "npx" }), app.repo.path),
    onlyInRepo(mcpServer({ name: "api", command: "npx" }), second.path),
  ]);
  return { app, second, repos: [app.repo.path, second.path] };
}
