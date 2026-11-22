import type { UiVersion } from "../ui-versions/index.ts";
import { type Ctx, NO_CHANGE, showIdle } from "./context.ts";
import { ModifyRefusal } from "./types.ts";

function needReady(ctx: Ctx): void {
  if (ctx.state.status !== "ready") {
    throw new ModifyRefusal("nothing-to-keep", "There is no change waiting to be kept.");
  }
}

/** Forgets the change, so a turn or check of it that is still running stops and a request starts fresh. */
function forget(ctx: Ctx): void {
  ctx.change = { ...NO_CHANGE, generation: ctx.change.generation + 1 };
}

function settle(ctx: Ctx): void {
  forget(ctx);
  showIdle(ctx);
}

/** Keep: the change in the live UI becomes a version whose message is the user's request. */
export async function keepChange(ctx: Ctx): Promise<void> {
  needReady(ctx);
  const { kind, requests, merge } = ctx.change;
  if (kind === "update" && merge) {
    await ctx.versions.finishUpdate({ dir: ctx.workspace.liveDir, templateVersion: merge.version });
    ctx.available = undefined;
  } else {
    await ctx.workspace.keep(requests.join("; "));
  }
  settle(ctx);
}

/** Undo of a change that was promoted but not kept: live and staging go back to the last version. */
async function undoUnkept(ctx: Ctx): Promise<void> {
  forget(ctx);
  await ctx.turns.end();
  await ctx.workspace.resetToKept();
  showIdle(ctx);
}

/** Undo: drops the waiting change, or, with none waiting, goes back one kept version. */
export async function undoChange(ctx: Ctx): Promise<void> {
  const { status } = ctx.state;
  if (status === "ready") return undoUnkept(ctx);
  if (status !== "idle") {
    throw new ModifyRefusal("modify-busy", "Discard the current attempt instead.");
  }
  const undone = await ctx.workspace.undo();
  if (!undone) throw new ModifyRefusal("nothing-to-undo", "There is nothing to undo.");
  showIdle(ctx);
}

/** Throws away the attempt in progress or the failed one; the live UI is untouched. */
export async function discardChange(ctx: Ctx): Promise<void> {
  const { status } = ctx.state;
  if (status === "idle")
    throw new ModifyRefusal("nothing-to-discard", "There is nothing to discard.");
  if (status === "ready") return undoUnkept(ctx);
  forget(ctx);
  await ctx.turns.end();
  await ctx.workspace.discardStaging();
  showIdle(ctx);
}

/** Restores an earlier version as a new one; not while a change is being made or waits. */
export async function restoreVersion(ctx: Ctx, commit: string): Promise<UiVersion> {
  const { status } = ctx.state;
  if (status !== "idle" && status !== "failed") {
    throw new ModifyRefusal("modify-busy", "Keep, undo or discard the current change first.");
  }
  await ctx.turns.end();
  const version = await ctx.workspace.restore(commit);
  settle(ctx);
  return version;
}
