import type { Folder } from "../setup/config-app.ts";
import {
  expectFileNotToContain,
  expectFileToContain,
  expectJsonValue,
  expectNoFile,
} from "./config-expectations.ts";
import { expectImportedItems } from "./import-expectations.ts";

const CODEX = ".codex/config.toml";
const HAND_WRITTEN_CODEX =
  '# my codex settings\nmodel = "gpt-5"\n\n[mcp_servers.mine]\ncommand = "my-server"\n';

/** Claude Code's own file lists the MCP server and runs this command. */
export function expectClaudeCodeToListServer(
  home: Folder,
  server: { name: string; command: string },
): Promise<void> {
  const path = `mcpServers.${server.name}.command`;
  return expectJsonValue(home, { file: ".claude.json", path, value: server.command });
}

/** Codex's own file has a table for the MCP server that runs this command. */
export function expectCodexToListServer(
  home: Folder,
  server: { name: string; command: string },
): Promise<void> {
  const text = `[mcp_servers.${server.name}]\ncommand = "${server.command}"`;
  return expectFileToContain(home, { file: CODEX, text });
}

/** Everything the user wrote by hand in both agents' files is still there. */
export async function expectHandWrittenConfigToBeKept(home: Folder): Promise<void> {
  await expectJsonValue(home, { file: ".claude.json", path: "theme", value: "dark" });
  const mine = { file: ".claude.json", path: "mcpServers.mine.command", value: "my-server" };
  await expectJsonValue(home, mine);
  await expectFileToContain(home, { file: CODEX, text: HAND_WRITTEN_CODEX });
}

/** Claude Code has the rules, the hook, the skill folder and the command file. */
export async function expectClaudeCodeToHaveRulesHookSkillAndCommand(home: Folder): Promise<void> {
  const file = ".claude/settings.json";
  await expectJsonValue(home, { file, path: "permissions.allow", value: ["Bash(git status:*)"] });
  await expectJsonValue(home, { file, path: "permissions.deny", value: ["Read(./.env)"] });
  await expectFileToContain(home, { file, text: "echo checking" });
  await expectFileToContain(home, { file: ".claude/skills/review/SKILL.md", text: "Be careful." });
  await expectFileToContain(home, { file: ".claude/commands/ship.md", text: "Ship it." });
}

/** Codex has the hook and the skill, the two of the four it supports. */
export async function expectCodexToHaveHookAndSkill(home: Folder): Promise<void> {
  await expectFileToContain(home, { file: ".codex/hooks.json", text: "echo checking" });
  await expectFileToContain(home, { file: ".agents/skills/review/SKILL.md", text: "Be careful." });
}

/** The instruction sits between its managed markers, and the user's own notes are still there. */
export async function expectInstructionBesideNotes(
  home: Folder,
  call: { file: string; notes: string },
): Promise<void> {
  const block =
    "<!-- agentcontrol:begin team-rules -->\nAlways write tests first.\n<!-- agentcontrol:end team-rules -->";
  await expectFileToContain(home, { file: call.file, text: block });
  await expectFileToContain(home, { file: call.file, text: call.notes });
}

/** Every entry the app wrote is gone from both agents' files and from disk. */
export async function expectManagedEntriesToBeGone(home: Folder): Promise<void> {
  await expectFileNotToContain(home, { file: ".claude.json", text: '"docs"' });
  await expectFileNotToContain(home, { file: CODEX, text: "[mcp_servers.docs]" });
  await expectNoFile(home, ".claude/skills/review/SKILL.md");
  await expectNoFile(home, ".claude/commands/ship.md");
  await expectNoFile(home, ".agents/skills/review/SKILL.md");
}

/** The auto-edit mode and the variable are in Claude Code's settings and in Codex's file. */
export async function expectModeAndVariableInBothAgents(home: Folder): Promise<void> {
  const file = ".claude/settings.json";
  await expectJsonValue(home, { file, path: "permissions.defaultMode", value: "acceptEdits" });
  await expectJsonValue(home, { file, path: "env.GREETING", value: "hello" });
  const topLevel =
    'model = "gpt-5"\napproval_policy = "on-request"\nsandbox_mode = "workspace-write"\n\n[mcp_servers.mine]';
  await expectFileToContain(home, { file: CODEX, text: topLevel });
  const table = '[shell_environment_policy.set]\nGREETING = "hello"';
  await expectFileToContain(home, { file: CODEX, text: table });
}

/** A remote server is an http server in Claude Code's file and has its url and headers in Codex's. */
export async function expectRemoteServerInBothAgents(home: Folder): Promise<void> {
  const file = ".claude.json";
  await expectJsonValue(home, { file, path: "mcpServers.api.type", value: "http" });
  const url = { file, path: "mcpServers.api.url", value: "https://example.com/mcp" };
  await expectJsonValue(home, url);
  const codex =
    '[mcp_servers.api]\nurl = "https://example.com/mcp"\nhttp_headers = { "X-Team" = "core" }';
  await expectFileToContain(home, { file: CODEX, text: codex });
}

/** What the app applied for both agents comes back as items: the hook and instruction under the app's own ids. */
export function expectEveryKindOfItemToBeImported(
  items: { item: { id: string; kind: string } }[],
): void {
  expectImportedItems(items, [
    { id: "claude-code:mcp:docs", kind: "mcp" },
    { id: "claude-code:permission", kind: "permission" },
    { id: "claude-code:env", kind: "env" },
    { id: "claude-code:skill:review", kind: "skill" },
    { id: "claude-code:command:ship", kind: "command" },
    { id: "codex:mcp:docs", kind: "mcp" },
    { id: "codex:permission", kind: "permission" },
    { id: "codex:env", kind: "env" },
    { id: "codex:skill:review", kind: "skill" },
    { id: "audit", kind: "hook" },
    { id: "team-rules", kind: "instructions" },
  ]);
}
