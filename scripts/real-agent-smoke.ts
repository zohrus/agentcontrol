// Drives a real agent through the relay, app and SDK, one scenario at a time.
// Usage: bun run smoke:real [--agent claude-code] [--only a,b] [--record <folder>]
// Needs the agent's credentials (Claude Code: a login or ANTHROPIC_API_KEY) and costs a little money,
// so it is not part of `bun run check` or CI. Prints PASS or FAIL per scenario; exits 1 on any FAIL.
import { type Outcome, runScenarios } from "./real-agent/run-scenarios.ts";
import { scenarios } from "./real-agent/scenario-list.ts";

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

function print({ scenario, error, notes }: Outcome): void {
  console.log(`${error === undefined ? "PASS" : "FAIL"} (${scenario.id}) ${scenario.name}`);
  for (const note of notes) console.log(`       ${note}`);
  if (error !== undefined) console.log(`       ${error}`);
}

const agent = flag("agent") ?? "claude-code";
if (agent !== "claude-code") {
  console.log(`SKIP the "${agent}" agent has no real-agent scenarios here yet`);
  process.exit(0);
}
const only = flag("only")?.split(",") ?? [];
const chosen = scenarios.filter((scenario) => only.length === 0 || only.includes(scenario.id));
const outcomes = await runScenarios({
  chosen,
  settings: { agent, only, recordInto: flag("record") },
  report: print,
});
const failed = outcomes.filter((outcome) => outcome.error !== undefined).length;
console.log(`${String(outcomes.length - failed)} passed, ${String(failed)} failed`);
process.exit(failed === 0 ? 0 : 1);
