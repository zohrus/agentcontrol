import type { SessionEvent, SessionId } from "../../../packages/sdk/src/index.ts";
import type { Run } from "../scenario.ts";
import {
  agentTextOf,
  answersWith,
  describeRequest,
  requestOf,
  updatesOf,
  waitsForApproval,
  waitsForReply,
} from "../steps.ts";
import { expectThat, waitFor } from "../wait.ts";

// Read-only commands such as `ls` or `sleep` are allowed without asking, so these change something.
const TOUCH_PROMPT =
  "Run the shell command `touch created-by-agent.txt` with the Bash tool. Do nothing else.";
const COUNT_PROMPT = "Write the numbers from 1 to 600, one per line, with no other text.";

/** Tool calls of the execute kind that ended as completed. */
function completedCommands(events: SessionEvent[]): number {
  const updates = updatesOf(events);
  const commands = new Set(
    updates.flatMap((update) =>
      update.type === "tool-started" && update.kind === "execute" ? [update.toolCallId] : [],
    ),
  );
  return updates.filter(
    (update) =>
      update.type === "tool-updated" &&
      update.status === "completed" &&
      commands.has(update.toolCallId),
  ).length;
}

/** (b) The agent asks to run a command; rejecting it means the command does not run. */
export async function rejectACommand(run: Run): Promise<void> {
  const { world } = run;
  const id = await world.startsSession(TOUCH_PROMPT);
  const row = await waitsForApproval(world, id);
  run.note(describeRequest(row));
  const kind = requestOf(row).toolCall.kind;
  expectThat(kind === "execute", `expected a request to run a command, got ${kind ?? "nothing"}`);
  await answersWith(world, { id, row, kind: "reject_once" });
  await waitsForReply(world, id);
  await run.record({ id, name: "reject-command" });
  const events = await world.eventsOf(id);
  expectThat(completedCommands(events) === 0, "expected the rejected command not to have run");
}

/** Resolves once the agent has started writing its reply. */
function waitsForTheAgentToWrite(run: Run, id: SessionId): Promise<void> {
  return waitFor({
    describe: "the agent to start writing",
    read: async () => {
      const events = await run.world.eventsOf(id);
      return agentTextOf(events) === "" ? undefined : true;
    },
  }).then(() => undefined);
}

function endedAsCancelled(events: SessionEvent[]): boolean {
  return events.some(
    (event) => event.kind === "turn-ended" && event.payload.stopReason === "cancelled",
  );
}

/** (c) A turn that is busy writing is cancelled and ends as cancelled, quickly. */
export async function cancelATurn(run: Run): Promise<void> {
  const { world } = run;
  const id = await world.startsSession(COUNT_PROMPT);
  await waitsForTheAgentToWrite(run, id);
  const cancelledAt = Date.now();
  await world.app.sdk.sessions.cancel(id);
  const events = await waitFor({
    describe: "the turn to end as cancelled",
    read: async () => {
      const all = await world.eventsOf(id);
      return endedAsCancelled(all) ? all : undefined;
    },
    timeoutMs: 30_000,
  });
  await run.record({ id, name: "cancel-turn" });
  run.note(
    `cancelled after ${String(Date.now() - cancelledAt)} ms; ${String(events.length)} events`,
  );
  const final = await world.app.sdk.sessions.get(id);
  expectThat(!final.turnRunning, "expected no turn to be running after the cancel");
}
