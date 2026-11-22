import { z } from "zod";
import { AgentKind } from "../ids/index.ts";

/** The agents that have harness configuration: every agent kind except the mock. */
export const ConfigAgent = AgentKind.exclude(["mock"]);
export type ConfigAgent = z.infer<typeof ConfigAgent>;

const id = z.string().min(1);
const name = z.string().min(1);
const strings = z.record(z.string(), z.string());

export const McpItem = z.object({
  id,
  kind: z.literal("mcp"),
  name,
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: strings.optional(),
  url: z.string().optional(),
  headers: strings.optional(),
});
export type McpItem = z.infer<typeof McpItem>;

export const InstructionsItem = z.object({
  id,
  kind: z.literal("instructions"),
  name,
  text: z.string(),
});
export type InstructionsItem = z.infer<typeof InstructionsItem>;

export const SkillItem = z.object({
  id,
  kind: z.literal("skill"),
  name,
  files: z.array(z.object({ path: z.string().min(1), content: z.string() })),
});
export type SkillItem = z.infer<typeof SkillItem>;

export const HookEvent = z.enum(["before-tool", "after-edit", "session-start", "session-stop"]);
export type HookEvent = z.infer<typeof HookEvent>;

export const HookItem = z.object({
  id,
  kind: z.literal("hook"),
  name,
  event: HookEvent,
  matcher: z.string().optional(),
  command: z.string().min(1),
});
export type HookItem = z.infer<typeof HookItem>;

export const CommandItem = z.object({
  id,
  kind: z.literal("command"),
  name,
  description: z.string().optional(),
  prompt: z.string(),
});
export type CommandItem = z.infer<typeof CommandItem>;

export const PermissionMode = z.enum(["ask", "auto-edit", "full-auto"]);
export type PermissionMode = z.infer<typeof PermissionMode>;

export const PermissionItem = z.object({
  id,
  kind: z.literal("permission"),
  allow: z.array(z.string()),
  deny: z.array(z.string()),
  mode: PermissionMode.optional(),
});
export type PermissionItem = z.infer<typeof PermissionItem>;

export const EnvItem = z.object({ id, kind: z.literal("env"), vars: strings });
export type EnvItem = z.infer<typeof EnvItem>;

export const ConfigItem = z.discriminatedUnion("kind", [
  McpItem,
  InstructionsItem,
  SkillItem,
  HookItem,
  CommandItem,
  PermissionItem,
  EnvItem,
]);
export type ConfigItem = z.infer<typeof ConfigItem>;

export const ConfigScope = z.object({
  scope: z.enum(["global", "workspace", "repo"]),
  repoPath: z.string().optional(),
});
export type ConfigScope = z.infer<typeof ConfigScope>;

export const ScopedItem = z.object({ item: ConfigItem, scope: ConfigScope, enabled: z.boolean() });
export type ScopedItem = z.infer<typeof ScopedItem>;
