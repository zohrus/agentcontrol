import { z } from "zod";
import { ConfigAgent } from "./items.ts";

export const FileChange = z.object({
  path: z.string(),
  before: z.string().optional(),
  after: z.string().optional(),
  action: z.enum(["create", "update", "delete"]),
});
export type FileChange = z.infer<typeof FileChange>;

export const UnsupportedItem = z.object({
  itemId: z.string(),
  agent: ConfigAgent,
  reason: z.string(),
});
export type UnsupportedItem = z.infer<typeof UnsupportedItem>;

export const ConfigPlan = z.object({
  planId: z.string(),
  changes: z.array(FileChange),
  unsupported: z.array(UnsupportedItem),
  needsSecret: z.array(z.object({ itemId: z.string(), secret: z.string() })),
});
export type ConfigPlan = z.infer<typeof ConfigPlan>;

export const ApplyResult = z.object({ backupId: z.string(), written: z.array(z.string()) });
export type ApplyResult = z.infer<typeof ApplyResult>;

export const DriftReport = z.object({
  entries: z.array(
    z.object({
      path: z.string(),
      itemIds: z.array(z.string()),
      status: z.enum(["in-sync", "drift", "missing"]),
    }),
  ),
});
export type DriftReport = z.infer<typeof DriftReport>;
