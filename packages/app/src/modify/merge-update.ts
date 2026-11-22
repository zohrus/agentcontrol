import type { MergeOutcome } from "../ui-versions/index.ts";
import { type Ctx, isStale, show } from "./context.ts";
import { runRounds } from "./rounds.ts";
import { INSTRUCTION, updatePrompt } from "./rules.ts";

/** How many of the user's kept changes since the last default UI touched none of the conflicted files. */
async function keptAutomatically(ctx: Ctx, conflicted: string[]): Promise<number> {
  const history = await ctx.versions.history();
  const lastDefault = history.findIndex((v) => v.kind === "template" || v.kind === "update");
  const since = history.slice(0, lastDefault < 0 ? history.length : lastDefault);
  const changes = since.filter((version) => version.kind === "change");
  const conflicts = await Promise.all(
    changes.map(async (change) => {
      const before = history[history.indexOf(change) + 1];
      const files = before
        ? await ctx.versions.diff({ from: before.commit, to: change.commit })
        : [];
      return files.some((file) => conflicted.includes(file.path));
    }),
  );
  return conflicts.filter((conflicting) => !conflicting).length;
}

/** What the merge did, and the agent's first turn when it must resolve conflicts. */
async function describeMerge(ctx: Ctx, options: { version: string; outcome: MergeOutcome }) {
  const { version, outcome } = options;
  const { conflictedFiles, keptRequests } = outcome;
  const text = updatePrompt({ instruction: INSTRUCTION, version, conflictedFiles, keptRequests });
  const kept = await keptAutomatically(ctx, conflictedFiles);
  const merge = { version, keptAutomatically: kept, conflictsResolved: conflictedFiles.length };
  const turn = { text, firstPrompt: text, title: ctx.change.title };
  return { merge, preface: text, first: conflictedFiles.length > 0 ? turn : undefined };
}

/** Merges upstream into staging; conflicts go to the agent with the user's earlier requests. */
export async function mergeUpdate(
  ctx: Ctx,
  options: { version: string; generation: number },
): Promise<void> {
  const { version, generation } = options;
  await ctx.turns.end();
  await ctx.workspace.discardStaging();
  if (isStale(ctx, generation)) return;
  const outcome = await ctx.versions.startUpdate(ctx.workspace.stagingDir);
  const { merge, preface, first } = await describeMerge(ctx, { version, outcome });
  if (isStale(ctx, generation)) return;
  Object.assign(ctx.change, { merge, preface });
  show(ctx, first ? "working" : "checking");
  await runRounds(ctx, { first, generation });
}
