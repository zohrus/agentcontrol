import type { SessionEvent, UsageRow } from "../../../packages/sdk/src/index.ts";
import type { Run } from "../scenario.ts";
import { agentTextOf, countKind, flowSessionOf, messageOf } from "../steps.ts";
import { expectThat, waitFor } from "../wait.ts";

const SECOND_PROMPT =
  "What greeting text does greeting.js export now? Answer with that text only. " +
  "Do not change anything and do not run commands.";

function waitsForTurns(run: Run, count: number): Promise<SessionEvent[]> {
  const id = flowSessionOf(run);
  return waitFor({
    describe: `${String(count)} finished turns`,
    read: async () => {
      const events = await run.world.eventsOf(id);
      return countKind(events, "turn-ended") >= count ? events : undefined;
    },
  });
}

/** What the agent wrote after the last prompt the user sent. */
function lastAnswerOf(events: SessionEvent[]): string {
  return agentTextOf(events.slice(events.findLastIndex((event) => event.kind === "prompt-sent")));
}

/** (d) A second prompt in the same session is answered, with what the first turn did in mind. */
export async function secondPrompt(run: Run): Promise<void> {
  const id = flowSessionOf(run);
  await run.world.app.sdk.sessions.sendPrompt(id, SECOND_PROMPT);
  const events = await waitsForTurns(run, 2);
  const second = lastAnswerOf(events);
  run.note(`second answer: ${second.slice(0, 80)}`);
  await run.record({ id, name: "second-prompt" });
  expectThat(second.includes("Hello, agent"), "expected the second turn to know the new greeting");
}

function describeUsage(row: UsageRow): string {
  const tokens = `in ${String(row.inputTokens)} out ${String(row.outputTokens)}`;
  const cache = `cache r/w ${String(row.cacheReadTokens)}/${String(row.cacheWriteTokens)}`;
  return `usage: ${row.model ?? "no model"} ${tokens} ${cache} cost ${String(row.costUsd)}`;
}

/** (e) Usage: one row per turn with token counts and the model. */
export async function usagePerTurn(run: Run): Promise<void> {
  const rows = await run.world.app.sdk.sessions.usage(flowSessionOf(run));
  rows.forEach((row) => {
    run.note(describeUsage(row));
  });
  expectThat(
    rows.length === 2,
    `expected one usage row per finished turn, got ${String(rows.length)}`,
  );
  const complete = rows.every((row) => row.outputTokens > 0 && row.model !== undefined);
  expectThat(complete, "expected output tokens and a model on every usage row");
}

/** (f) The app restarts in the middle of the session: nothing lost, nothing twice. */
export async function appRestart(run: Run): Promise<void> {
  const id = flowSessionOf(run);
  const before = await run.world.eventsOf(id);
  await run.world.app.restartsTheApp();
  const after = await run.world.eventsOf(id);
  const same = JSON.stringify(after) === JSON.stringify(before);
  expectThat(
    same,
    `expected the same ${String(before.length)} events, got ${String(after.length)}`,
  );
  expectThat(
    new Set(after.map((event) => event.seq)).size === after.length,
    "expected no duplicates",
  );
  const row = await run.world.app.sdk.sessions.get(id);
  expectThat(
    row.waitingReason === "reply",
    `expected the session to wait for a reply, it is ${row.status}`,
  );
}

/** (h) Archive: asks first about uncommitted work, then removes the worktree and keeps branch and log. */
export async function archive(run: Run): Promise<void> {
  const { world } = run;
  const id = flowSessionOf(run);
  const first = await world.app.sdk.sessions.archive(id).then(
    () => "archive without force went through, with no warning about uncommitted changes",
    (error: unknown) => `archive warned first: ${messageOf(error)}`,
  );
  run.note(first);
  await world.app.sdk.sessions.archive(id, { force: true });
  const row = await world.app.sdk.sessions.get(id);
  expectThat(row.status === "archived", `expected the session to be archived, it is ${row.status}`);
  expectThat(await Bun.file(world.logOf(id)).exists(), "expected the event log to be kept");
  const branches = await Bun.$`git branch --list ${`agentcontrol/${id}`}`
    .cwd(world.app.repoPath)
    .text();
  expectThat(branches.includes(id), "expected the session's branch to be kept");
}
