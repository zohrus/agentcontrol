import type { WorkspaceProgress } from "@agentcontrol/sdk";
import type { Context } from "./context.ts";
import type { SetupStep } from "./model.ts";

/**
 * Puts a step into the list in the order steps first appeared. A step that already passed stays
 * passed when it starts again: a setup that is run after another one repeats its first steps, and
 * showing them as running again would only flicker.
 */
function withStep(steps: readonly SetupStep[], next: SetupStep): readonly SetupStep[] {
  const known = steps.find((each) => each.id === next.id);
  if (known === undefined) return [...steps, next];
  if (known.state === "ok" && next.state === "started") return steps;
  return steps.map((each) => (each.id === next.id ? next : each));
}

/** One step of a setup was announced on the live stream: keep it under its request. */
export function applyProgress(ctx: Context, progress: WorkspaceProgress): void {
  const { requestId, step, label, state, message } = progress;
  const next: SetupStep = { id: step, label, state, message };
  ctx.store.update((s) => ({
    ...s,
    setup: { ...s.setup, [requestId]: withStep(s.setup[requestId] ?? [], next) },
  }));
}
