import { access } from "node:fs/promises";
import type { SessionId } from "@agentcontrol/protocol";
import type { SessionContext } from "./context.ts";
import { timedInBackground } from "./timed.ts";

/** When the relay's environment names a file, the deletion waits for it to exist: lets a test hold it. */
const HOLD_VARIABLE = "AGENTCONTROL_HOLD_DELETION_UNTIL";

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

async function heldUntil(path: string | undefined): Promise<void> {
  while (path !== undefined && !(await exists(path))) await Bun.sleep(25);
}

/**
 * Deletes the files of a worktree that was moved aside, without anyone waiting for it, and says
 * how long it took in the archived session's log. If the relay stops first, the folder is deleted
 * by the sweep when the next relay starts.
 */
export function deleteInBackground(
  ctx: SessionContext,
  call: { sessionId: SessionId; removal: { pending: boolean; finish(): Promise<void> } },
): void {
  const { sessionId, removal } = call;
  if (!removal.pending) return;
  const timed = timedInBackground(ctx, { sessionId, phase: "archive" });
  const deleting = {
    id: "delete",
    doing: "Deleting the old worktree folder",
    done: "Deleted the old worktree folder",
  };
  const work = async (): Promise<void> => {
    await heldUntil(ctx.hostEnv[HOLD_VARIABLE]);
    await removal.finish();
  };
  timed(deleting, work).catch((error: unknown) => {
    console.error(
      `Could not delete the old worktree folder of session ${sessionId}: ${String(error)}`,
    );
  });
}
