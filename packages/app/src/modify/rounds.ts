import type { CheckResult } from "../ui-workspace/index.ts";
import { type Ctx, isStale, show } from "./context.ts";
import { checkFeedback, trimOutput } from "./rules.ts";

/** How often the agent is sent the check errors before the change is given up. */
const MAX_FIX_ROUNDS = 3;

interface Turn {
  text: string;
  firstPrompt: string;
  title: string;
}

type Failed = CheckResult["steps"][number];

/** Plain language for the user; the agent-facing detail stays in the check output. */
async function fail(ctx: Ctx, options: { failure: string; checkOutput?: string }): Promise<void> {
  const changedFiles = await ctx.workspace.pendingChanges().catch(() => []);
  const { failure, checkOutput } = options;
  show(ctx, "failed", { failure, changedFiles, ...(checkOutput ? { checkOutput } : {}) });
}

function summaryOf(ctx: Ctx, changed: string[]): string {
  const { merge } = ctx.change;
  if (!merge)
    return `${String(changed.length)} ${changed.length === 1 ? "file" : "files"} changed.`;
  const { version, keptAutomatically, conflictsResolved } = merge;
  const kept = `${String(keptAutomatically)} of your changes kept automatically`;
  return `Update ${version}: ${kept}, ${String(conflictsResolved)} ${conflictsResolved === 1 ? "conflict" : "conflicts"} resolved`;
}

/** The checks passed: put the change into the live UI and wait for Keep or Undo. */
async function promote(ctx: Ctx, generation: number): Promise<void> {
  const changed = await ctx.workspace.pendingChanges();
  if (isStale(ctx, generation)) return;
  if (changed.length === 0) {
    await fail(ctx, { failure: "The Modify agent finished without changing anything." });
    return;
  }
  await ctx.workspace.promote();
  const [newest] = await ctx.versions.history();
  if (newest) ctx.change.baseCommit = newest.commit;
  show(ctx, "ready", { changedFiles: changed, summary: summaryOf(ctx, changed) });
}

function feedbackTurn(ctx: Ctx, failed: Failed): Turn {
  const text = checkFeedback(failed);
  const { preface, title } = ctx.change;
  return { text, firstPrompt: `${preface}\n\n${text}`, title };
}

async function checkStep(ctx: Ctx, generation: number): Promise<Failed | "stale" | undefined> {
  show(ctx, "checking");
  const result = await ctx.workspace.runChecks();
  if (isStale(ctx, generation)) return "stale";
  return result.steps.find((step) => !step.ok);
}

/** Runs the agent's turn; "stop" when the change was discarded meanwhile or the agent failed. */
async function runTurn(
  ctx: Ctx,
  options: { turn: Turn; generation: number },
): Promise<"go" | "stop"> {
  const { generation } = options;
  const outcome = await ctx.turns.run({ ...options.turn, wanted: () => !isStale(ctx, generation) });
  if (isStale(ctx, options.generation)) return "stop";
  if (outcome.ok) return "go";
  await fail(ctx, { failure: outcome.reason });
  return "stop";
}

/** Passed: promote. Failed: send the errors back, or give up after the last round. */
async function conclude(
  ctx: Ctx,
  options: { failed: Failed | undefined; round: number; generation: number },
): Promise<Turn | undefined> {
  const { failed, round, generation } = options;
  if (!failed) {
    await promote(ctx, generation);
    return undefined;
  }
  const checkOutput = trimOutput(failed.output);
  if (round < MAX_FIX_ROUNDS) {
    show(ctx, "fixing", { checkOutput });
    return feedbackTurn(ctx, failed);
  }
  const tries = `the agent tried to fix it ${String(MAX_FIX_ROUNDS)} times`;
  await fail(ctx, {
    failure: `The change still did not pass the checks after ${tries}, so nothing was changed.`,
    checkOutput,
  });
  return undefined;
}

/** One turn (when there is one to run), then the checks. Returns the next turn, or nothing when done. */
async function attempt(
  ctx: Ctx,
  options: { round: number; turn: Turn | undefined; generation: number },
): Promise<Turn | undefined> {
  const { round, turn, generation } = options;
  if (turn && (await runTurn(ctx, { turn, generation })) === "stop") return undefined;
  const failed = await checkStep(ctx, generation);
  if (failed === "stale") return undefined;
  return conclude(ctx, { failed, round, generation });
}

/**
 * Runs the agent's turn, then the checks; while they fail, sends the errors back, up to three
 * times. Ends in `ready` (promoted to live) or `failed` (live untouched). Without a first turn
 * (a clean update) it starts with the checks.
 */
export async function runRounds(
  ctx: Ctx,
  options: { first: Turn | undefined; generation: number },
): Promise<void> {
  const { generation } = options;
  let turn = options.first;
  for (let round = 0; ; round++) {
    const next = await attempt(ctx, { round, turn, generation });
    if (next === undefined) return;
    turn = next;
  }
}

/**
 * Runs `work` in the background, handing it the change's generation: it must stop when `isStale`.
 * Anything it throws becomes a failure the user can read.
 */
export function inBackground(ctx: Ctx, work: (generation: number) => Promise<void>): void {
  const generation = ctx.change.generation;
  work(generation)
    .catch(async (error: unknown) => {
      if (isStale(ctx, generation)) return;
      const reason = error instanceof Error ? error.message : String(error);
      await fail(ctx, { failure: `Something went wrong: ${reason}` });
    })
    .catch((error: unknown) => {
      console.error(`The Modify agent could not report a failure: ${String(error)}`);
    });
}

export type { Turn };
