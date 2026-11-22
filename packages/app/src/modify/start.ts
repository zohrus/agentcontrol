import { type Ctx, isStale, show, startChange } from "./context.ts";
import { mergeUpdate } from "./merge-update.ts";
import { inBackground, runRounds } from "./rounds.ts";
import { INSTRUCTION, requestPrompt } from "./rules.ts";
import { ModifyRefusal } from "./types.ts";

const titleOf = (request: string): string => request.split("\n")[0]?.slice(0, 80) ?? "";

function refuseUnlessFree(ctx: Ctx, request: string): void {
  if (request.trim() === "") throw new ModifyRefusal("invalid-request", "Say what to change.");
  const { status } = ctx.state;
  if (status === "idle" || status === "failed") return;
  const message =
    status === "ready"
      ? "Keep or undo the change that is waiting first."
      : "The Modify agent is still working on the last request.";
  throw new ModifyRefusal("modify-busy", message);
}

async function begin(
  ctx: Ctx,
  options: { request: string; fresh: boolean; generation: number },
): Promise<void> {
  const { request, fresh, generation } = options;
  ctx.change.preface = INSTRUCTION;
  if (fresh) {
    await ctx.turns.end();
    await ctx.workspace.discardStaging();
    if (isStale(ctx, generation)) return;
  }
  const firstPrompt = requestPrompt({ instruction: INSTRUCTION, request });
  const first = { text: request, firstPrompt, title: titleOf(request) };
  await runRounds(ctx, { first, generation });
}

/**
 * Takes the user's request: staging is made equal to the live UI, the Modify agent edits it, and
 * the checks run (see `runRounds`). Returns at once; the state shows how it goes. After a failed
 * attempt the new message continues the same session.
 */
export function startRequest(ctx: Ctx, request: string): void {
  refuseUnlessFree(ctx, request);
  const fresh = ctx.state.status !== "failed" || ctx.change.kind !== "change";
  if (fresh)
    startChange(ctx, { kind: "change", requests: [], preface: "", title: titleOf(request) });
  ctx.change.requests.push(request);
  show(ctx, "working", { request: ctx.change.requests.join("\n") });
  inBackground(ctx, (generation) => begin(ctx, { request, fresh, generation }));
}

/** Merges the available default-UI update; nothing reaches the live UI until the checks pass. */
export function startUpdate(ctx: Ctx): void {
  const version = ctx.available;
  if (version === undefined) throw new ModifyRefusal("no-update", "There is no update to apply.");
  if (ctx.state.status !== "idle") {
    throw new ModifyRefusal("modify-busy", "Finish the current change first.");
  }
  startChange(ctx, { kind: "update", requests: [], preface: "", title: `Update ${version}` });
  show(ctx, "working");
  inBackground(ctx, (generation) => mergeUpdate(ctx, { version, generation }));
}
