import { randomUUID } from "node:crypto";
import type { ConfigAgent, ConfigPlan, ConfigFileChange, ScopedItem } from "@agentcontrol/protocol";
import { ADAPTERS } from "./adapters.ts";
import { makeCtx } from "./fs.ts";
import { manifestPath, mergeManifest, parseManifest } from "./manifest.ts";
import { findSecrets } from "./secrets.ts";
import type { Manifest, RenderResult } from "./types.ts";

export interface PlanInput {
  items: ScopedItem[];
  agents: ConfigAgent[];
  homeDir: string;
  repoPath?: string | undefined;
}

/** What apply needs to write the plan and to notice that files moved since it was made. */
export interface StoredPlan {
  homeDir: string;
  changes: ConfigFileChange[];
  manifestBefore: string | undefined;
  manifestAfter: Manifest;
}

/** The plan is unknown, or a file it covers changed after it was made: plan again. */
export class StalePlanError extends Error {}

const stored = new Map<string, StoredPlan>();

export const takePlan = (planId: string): StoredPlan | undefined => stored.get(planId);
export const forgetPlan = (planId: string): void => void stored.delete(planId);

function mergeResults(results: RenderResult[]): RenderResult {
  return {
    files: new Map(results.flatMap((r) => [...r.files])),
    deleted: results.flatMap((r) => r.deleted),
    managed: Object.fromEntries(results.flatMap((r) => Object.entries(r.managed))),
    unsupported: results.flatMap((r) => r.unsupported),
  };
}

async function diff(
  merged: RenderResult,
  read: (path: string) => Promise<string | undefined>,
): Promise<ConfigFileChange[]> {
  const paths = [...merged.files.keys(), ...merged.deleted].sort();
  return Promise.all(
    paths.map(async (path) => {
      const before = await read(path);
      const after = merged.files.get(path);
      if (after === undefined) return { path, before, action: "delete" as const };
      return {
        path,
        before,
        after,
        action: before === undefined ? ("create" as const) : ("update" as const),
      };
    }),
  );
}

/** Work out the native file changes for the given items without writing anything. */
export async function planConfig(input: PlanInput): Promise<ConfigPlan> {
  const ctx = makeCtx(input);
  const manifestBefore = await ctx.readFile(manifestPath(input.homeDir));
  const manifest = parseManifest(manifestBefore);
  const renders = input.agents.map((a) => ADAPTERS[a].render(input.items, { ...ctx, manifest }));
  const merged = mergeResults(await Promise.all(renders));
  const changes = await diff(merged, (path) => ctx.readFile(path));
  const manifestAfter = mergeManifest({
    old: manifest,
    agents: input.agents,
    managed: merged.managed,
  });
  const planId = randomUUID();
  stored.set(planId, { homeDir: input.homeDir, changes, manifestBefore, manifestAfter });
  const secrets = findSecrets(input.items.filter((s) => s.enabled).map((s) => s.item));
  return { planId, changes, unsupported: merged.unsupported, needsSecret: secrets };
}
