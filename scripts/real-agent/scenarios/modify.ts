import { join } from "node:path";
import type { ModifyState, SessionEvent } from "../../../packages/sdk/src/index.ts";
import type { Run } from "../scenario.ts";
import { describeCounts, otherNames, updatesOf } from "../steps.ts";
import { expectThat, waitFor } from "../wait.ts";

const PROMPT = "change the footer text to Real agent was here. First run ls to see the files.";
const NEW_TEXT = "Real agent was here";
const MODIFY_TIMEOUT_MS = 240_000;

function settled(run: Run): Promise<ModifyState> {
  return waitFor({
    describe: "the Modify request to be ready or failed",
    read: async () => {
      const state = await run.world.app.sdk.modify.state();
      return state.status === "ready" || state.status === "failed" ? state : undefined;
    },
    timeoutMs: MODIFY_TIMEOUT_MS,
  });
}

/** Reasons the relay gave when it answered a permission request by itself. */
function fenceDecisions(events: SessionEvent[]): string[] {
  return events.flatMap((event) =>
    event.kind === "permission-answered" && event.payload.automatic
      ? [event.payload.automatic.reason]
      : [],
  );
}

function toolsTried(events: SessionEvent[]): string[] {
  return updatesOf(events).flatMap((update) =>
    update.type === "tool-started" ? [`${update.kind}:${update.title}`] : [],
  );
}

function noteWhatHappened(run: Run, events: SessionEvent[]): void {
  run.note(`tools tried: ${toolsTried(events).join(" | ") || "none"}`);
  run.note(`fence decisions: ${fenceDecisions(events).join("; ") || "none"}`);
  run.note(`other updates: ${describeCounts(otherNames(events))}`);
}

async function expectLiveUiHoldsTheText(run: Run, state: ModifyState): Promise<void> {
  const folder = join(run.world.app.dataDir, "ui", "src");
  const found = await Bun.$`grep -r ${NEW_TEXT} ${folder}`.nothrow().text();
  expectThat(
    found.includes(NEW_TEXT),
    `expected the live UI to hold the new text; changed files: ${state.changedFiles.join(", ")}`,
  );
}

async function expectKeepRecordsTheRequest(run: Run): Promise<void> {
  await run.world.app.sdk.modify.keep();
  const [newest] = await run.world.app.sdk.modify.history();
  expectThat(
    newest?.message === PROMPT,
    `expected the newest version to be the request, it is "${newest?.message ?? "nothing"}"`,
  );
}

/** (i) A Modify request with the real agent: fenced to staging, checked, promoted, and Keep records a version. */
export async function modifyTheUi(run: Run): Promise<void> {
  await run.world.app.sdk.modify.request(PROMPT);
  const state = await settled(run);
  expectThat(state.sessionId !== undefined, "expected the Modify request to have a session");
  await run.record({ id: state.sessionId, name: "modify-ui" });
  noteWhatHappened(run, await run.world.eventsOf(state.sessionId));
  expectThat(state.status === "ready", `expected the change to be ready: ${state.failure ?? ""}`);
  await expectLiveUiHoldsTheText(run, state);
  await expectKeepRecordsTheRequest(run);
}
