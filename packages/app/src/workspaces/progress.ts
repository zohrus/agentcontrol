import type { CheckStep } from "@agentcontrol/protocol";
import type { Hub } from "../sync/index.ts";

/** Tells whoever asked for a setup (or a check) how each step is going, as it goes. */
export interface Reporter {
  /** A step has begun. */
  begin(step: { id: string; label: string; message: string }): void;
  /** A step has ended with this result; a skipped step is not reported (it never began). */
  end(result: CheckStep): void;
}

/** A reporter that says nothing: for a caller that did not ask for progress. */
export const silent: Reporter = {
  begin: () => undefined,
  end: () => undefined,
};

/**
 * A reporter that publishes each step on the live stream under the caller's request id. Without a
 * request id nobody could tell which setup the steps belong to, so it says nothing.
 */
export function reporterFor(call: {
  hub: Hub;
  requestId: string | undefined;
  workspaceId: string | undefined;
}): Reporter {
  const { hub, requestId, workspaceId } = call;
  if (requestId === undefined) return silent;
  const ids = { requestId, ...(workspaceId === undefined ? {} : { workspaceId }) };
  return {
    begin: ({ id, label, message }) => {
      hub.publish({
        type: "workspace-progress",
        progress: { ...ids, step: id, label, state: "started", message },
      });
    },
    end: ({ id, label, status, detail }) => {
      if (status === "skipped") return;
      const state = status === "ok" ? "ok" : "failed";
      const message = detail ?? (status === "ok" ? "Done." : "It failed.");
      hub.publish({
        type: "workspace-progress",
        progress: { ...ids, step: id, label, state, message },
      });
    },
  };
}

/** Runs one step: reports that it began, runs it, reports how it ended, and returns the result. */
export async function reported(options: {
  report: Reporter;
  begin: { id: string; label: string; message: string };
  work: () => Promise<CheckStep> | CheckStep;
}): Promise<CheckStep> {
  const { report, begin } = options;
  report.begin(begin);
  try {
    const result = await options.work();
    report.end(result);
    return result;
  } catch (error) {
    // A step that throws must not stay "started" for ever on the live stream.
    const detail = error instanceof Error ? error.message : String(error);
    report.end({ id: begin.id, label: begin.label, status: "failed", detail });
    throw error;
  }
}
