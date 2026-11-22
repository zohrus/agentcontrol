import { startAppWithEmptyHome, type ConfigApp } from "./config-app.ts";
import {
  beforeToolHook,
  command,
  environment,
  instructions,
  mcpServer,
  permissionRule,
  skill,
} from "./items.ts";

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
    skill({ name: "review", text: REVIEW_SKILL }),
    command({ name: "ship", prompt: "Ship it." }),
    environment({ GREETING: "hello" }),
  ]);
  await app.user.reviewsAndAppliesThePlan();
  return app;
}

/** A home folder where the user hand-wrote a Claude Code hook and notes. */
export async function startAppWithHandWrittenHookAndNotes(): Promise<ConfigApp> {
  const app = await startAppWithEmptyHome();
  const hook = { hooks: { Stop: [{ hooks: [{ type: "command", command: "echo done" }] }] } };
  await app.home.has(".claude/settings.json", JSON.stringify(hook, null, 2));
  await app.home.has(".claude/CLAUDE.md", "Be kind to reviewers.\n");
  return app;
}
