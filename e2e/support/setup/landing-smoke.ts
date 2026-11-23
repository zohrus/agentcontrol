import { join } from "node:path";
import { commitAll, gitIn, type Project, publishesMain, SMOKE_SCRIPT } from "./landing-project.ts";

/** The compiled app does not pass its smoke test any more, as main stands. */
export async function mainsSmokeTestFails(project: Project): Promise<void> {
  await gitIn(project, "checkout", "main");
  await Bun.write(join(project.work, SMOKE_SCRIPT), "process.exit(1);\n");
  await commitAll(project, "Break the smoke test");
  await publishesMain(project);
}
