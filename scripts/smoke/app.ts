// Runs the steps against a compiled app and prints PASS or FAIL for each. Returns true when all
// passed. Usage: bun scripts/smoke-binary.ts --app dist/release/linux-x64
import { type SmokeApp, startCompiledApp } from "./app-process.ts";
import { steps } from "./steps.ts";

/** Runs the steps in order and stops at the first that fails; true when none did. */
async function runSteps(app: SmokeApp): Promise<boolean> {
  for (const step of steps) {
    try {
      await step.run(app);
      console.log(`PASS  ${step.name}`);
    } catch (error) {
      console.log(`FAIL  ${step.name}\n      ${String(error)}`);
      return false;
    }
  }
  return true;
}

export async function smokeApp(releaseDir: string): Promise<boolean> {
  const app = await startCompiledApp(releaseDir).catch((error: unknown) => {
    console.log(`FAIL  the app starts and says it is listening\n      ${String(error)}`);
    return undefined;
  });
  if (app === undefined) return false;
  console.log(`PASS  the app starts and says it is listening (${app.baseUrl})`);
  const passed = await runSteps(app);
  if (!passed) console.log(`\nWhat the app printed:\n${app.output()}`);
  await app.stop();
  return passed;
}
