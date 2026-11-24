import { z } from "zod";
import { ConfigAgent, ScopedItem } from "./items.ts";

const repoPath = z.string().optional();

/** Params of relay/config.inspect: what the given agents have configured today. */
export const ConfigInspectParams = z.object({ agents: z.array(ConfigAgent), repoPath });
/** Result of relay/config.inspect: the existing setup as canonical items. */
export const ConfigInspectResult = z.object({ items: z.array(ScopedItem) });

/** Params of relay/config.plan: the desired items and the agents to write them for. */
export const ConfigPlanParams = z.object({
  items: z.array(ScopedItem),
  agents: z.array(ConfigAgent),
  repoPath,
  /**
   * More repositories the plan speaks for, besides `repoPath`: the files of every one of them are
   * planned (and entries the app wrote there earlier are removed when their item is gone) in this
   * one plan, which is applied and rolled back as one.
   */
  repoPaths: z.array(z.string()).optional(),
});

/** Params of relay/config.apply: a plan made earlier by relay/config.plan. */
export const ConfigApplyParams = z.object({ planId: z.string() });

/** Params of relay/config.rollback: the backup an earlier apply returned. */
export const ConfigRollbackParams = z.object({
  backupId: z.string().regex(/^[\w-]+$/),
  /** Put the files back even though some changed after the apply that made the backup. */
  force: z.boolean().optional(),
});
/**
 * Result of relay/config.rollback: every file that was put back or removed, or, when files changed
 * after the apply and `force` was not given, nothing restored and the files that changed listed.
 */
export const ConfigRollbackResult = z.object({
  restored: z.array(z.string()),
  changedSince: z.array(z.string()),
});

/** Params of relay/config.drift: none, every file the app manages is checked. */
export const ConfigDriftParams = z.object({});

export type ConfigInspectParams = z.infer<typeof ConfigInspectParams>;
export type ConfigInspectResult = z.infer<typeof ConfigInspectResult>;
export type ConfigPlanParams = z.infer<typeof ConfigPlanParams>;
export type ConfigApplyParams = z.infer<typeof ConfigApplyParams>;
export type ConfigRollbackParams = z.infer<typeof ConfigRollbackParams>;
export type ConfigRollbackResult = z.infer<typeof ConfigRollbackResult>;
export type ConfigDriftParams = z.infer<typeof ConfigDriftParams>;
