import { rm } from "node:fs/promises";
import type { ApplyResult, FileChange } from "@agentcontrol/protocol";
import { createBackup, rollbackConfig } from "./backup.ts";
import { readText, writeAtomic } from "./fs.ts";
import { manifestPath, serializeManifest } from "./manifest.ts";
import { type StoredPlan, StalePlanError, forgetPlan, takePlan } from "./plan.ts";

async function assertUnchanged(plan: StoredPlan): Promise<void> {
  const checks = [
    ...plan.changes.map((c) => ({ path: c.path, before: c.before })),
    { path: manifestPath(plan.homeDir), before: plan.manifestBefore },
  ];
  for (const { path, before } of checks) {
    if ((await readText(path)) !== before) {
      throw new StalePlanError(
        `${path} changed since the plan was made; plan again before applying`,
      );
    }
  }
}

async function writeChange(change: FileChange): Promise<void> {
  if (change.action === "delete") await rm(change.path, { force: true });
  else await writeAtomic(change.path, change.after ?? "");
}

async function writeAll(plan: StoredPlan): Promise<void> {
  for (const change of plan.changes) await writeChange(change);
  await writeAtomic(manifestPath(plan.homeDir), serializeManifest(plan.manifestAfter));
}

async function backUpAndWrite(plan: StoredPlan): Promise<string> {
  const { homeDir } = plan;
  const paths = [...plan.changes.map((c) => c.path), manifestPath(homeDir)];
  const backupId = await createBackup({ homeDir, paths });
  try {
    await writeAll(plan);
  } catch (error) {
    await rollbackConfig({ backupId, homeDir });
    throw error;
  }
  return backupId;
}

/** Back up, write, update the manifest. A failure part-way restores the backup. */
export async function applyConfig(input: { planId: string }): Promise<ApplyResult> {
  const plan = takePlan(input.planId);
  if (!plan)
    throw new StalePlanError("unknown plan: it was never made or has already been applied");
  await assertUnchanged(plan);
  const backupId = await backUpAndWrite(plan);
  forgetPlan(input.planId);
  const written = plan.changes.filter((c) => c.action !== "delete").map((c) => c.path);
  return { backupId, written };
}
