import { saveRecording } from "./recording.ts";
import type { Run, Scenario } from "./scenario.ts";
import { messageOf } from "./steps.ts";
import { openWorld, type World, type WorldOptions } from "./world.ts";

export interface Options {
  agent: WorldOptions["agent"];
  /** Only these scenario letters; all when empty. */
  only: string[];
  /** Save each scenario's event log as a recording in this folder. */
  recordInto: string | undefined;
}

/** What one scenario ended as, with its findings. */
export interface Outcome {
  scenario: Scenario;
  error: string | undefined;
  notes: string[];
}

function runOf(world: World, settings: Options, flow: Run["flow"]): { run: Run; notes: string[] } {
  const notes: string[] = [];
  const run: Run = {
    world,
    flow,
    note: (text) => notes.push(text),
    record: async ({ id, name }) => {
      if (settings.recordInto === undefined) return;
      await saveRecording({ logFile: world.logOf(id), folder: settings.recordInto, name });
    },
  };
  return { run, notes };
}

async function runOne(options: {
  scenario: Scenario;
  world: World;
  settings: Options;
  flow: Run["flow"];
}): Promise<Outcome> {
  const { scenario, world, settings, flow } = options;
  const { run, notes } = runOf(world, settings, flow);
  const error = await scenario.run(run).then(
    () => undefined,
    (reason: unknown) => messageOf(reason),
  );
  return { scenario, error, notes };
}

/** A scenario that shares the flow world runs there; the others get a world of their own. */
async function runInItsWorld(options: {
  scenario: Scenario;
  shared: World;
  settings: Options;
  flow: Run["flow"];
}): Promise<Outcome> {
  const { scenario, shared, settings, flow } = options;
  if (scenario.world === "flow") return runOne({ scenario, world: shared, settings, flow });
  const own = await openWorld({ agent: settings.agent, modify: scenario.world === "modify" });
  const outcome = await runOne({ scenario, world: own, settings, flow });
  await own.closes();
  return outcome;
}

/** Runs the chosen scenarios; each prints its outcome through `report` as soon as it is done. */
export async function runScenarios(options: {
  chosen: Scenario[];
  settings: Options;
  report: (outcome: Outcome) => void;
}): Promise<Outcome[]> {
  const { chosen, settings, report } = options;
  const flow: Run["flow"] = {};
  const shared = await openWorld({ agent: settings.agent });
  const outcomes: Outcome[] = [];
  for (const scenario of chosen) {
    const outcome = await runInItsWorld({ scenario, shared, settings, flow });
    outcomes.push(outcome);
    report(outcome);
  }
  await shared.closes();
  return outcomes;
}
