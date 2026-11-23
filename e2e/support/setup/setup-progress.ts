import type { WorkspaceProgress } from "@agentcontrol/sdk";
import type { AppAccess } from "./app.ts";
import { onTestEnd } from "./cleanup.ts";
import { Timeline } from "./timeline.ts";

const PROGRESS_WAIT_MS = 15_000;

/** What the live stream said about the steps of one setup, in order. */
export type SetupProgress = Timeline<WorkspaceProgress>;

/**
 * Listens to the live stream and keeps the steps announced for `requestId`. Resolves once the
 * stream is open, so nothing announced afterwards is missed.
 */
export function watchesTheSetupSteps(app: AppAccess, requestId: string): Promise<SetupProgress> {
  const steps: SetupProgress = new Timeline<WorkspaceProgress>(PROGRESS_WAIT_MS);
  return new Promise((resolve) => {
    const stop = app.sdk.subscribe({
      onWorkspaceProgress: (progress) => {
        if (progress.requestId === requestId) steps.record(progress);
      },
      onOpen: () => {
        resolve(steps);
      },
    });
    onTestEnd(() => {
      stop();
      return Promise.resolve();
    });
  });
}
