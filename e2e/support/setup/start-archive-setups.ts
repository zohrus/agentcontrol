import { rename } from "node:fs/promises";
import { join } from "node:path";
import type { AppAccess, Session } from "./app.ts";
import { onTestEnd } from "./cleanup.ts";
import { startsASessionWithoutABranch } from "./create-at-once-setups.ts";
import { git } from "./git.ts";
import { givesTheRepoARemote } from "./repo-remote.ts";
import { temporaryFolder } from "./release-folder.ts";
import { type RunningApp, startAppWithLocalWorkspace } from "./start-app.ts";

/** Every timed step of starting or archiving a session reports this long, whatever it really took. */
export const EVERY_STEP_TAKES_MS = 1500;

/** The text the steps show for that duration. */
export const EVERY_STEP_TAKES = "1.5 s";

const FIXED_STEP_VARIABLE = "AGENTCONTROL_STEP_MS";
const HOLD_DELETION_VARIABLE = "AGENTCONTROL_HOLD_DELETION_UNTIL";

/** Gives the repo a setup script, as the user writes one in the workspace's setup. */
export async function theRepoRunsASetupScript(app: AppAccess, script: string): Promise<void> {
  const repo = await app.sdk.repos.add(app.repoPath);
  await app.sdk.repos.setSetup(repo.repoId, { copyFiles: [".env*"], setupScript: script });
}

/** The app with a remote, a setup script, and a relay whose every step reports the same duration. */
export async function startAppWhereEveryStepTakesTheSameTime(
  options: { relayEnv?: Record<string, string>; remote?: "local" | "none" } = {},
): Promise<RunningApp> {
  const relayEnv = { [FIXED_STEP_VARIABLE]: String(EVERY_STEP_TAKES_MS), ...options.relayEnv };
  const app = await startAppWithLocalWorkspace({ relayEnv });
  // A test that makes the remote hang gives the repo that remote itself.
  if (options.remote !== "none") await givesTheRepoARemote(app.repoPath);
  await theRepoRunsASetupScript(app, "echo built");
  return app;
}

/** The deletion of an archived session's old folder, which the test holds and lets go. */
export interface HeldDeletion {
  /** The folder deletion goes on (and every held one with it). */
  goesOn(): Promise<void>;
}

/** The relay's environment that makes it wait before deleting an archived session's old folder. */
export async function aDeletionThatWaitsForTheTest(): Promise<{
  relayEnv: Record<string, string>;
  deletion: HeldDeletion;
}> {
  const signal = join(await temporaryFolder("agentcontrol-held-deletion-"), "go-on");
  const deletion = { goesOn: () => Bun.write(signal, "").then(() => undefined) };
  // However the test ends, nothing is left waiting for a file that will not come.
  onTestEnd(deletion.goesOn);
  return { relayEnv: { [HOLD_DELETION_VARIABLE]: signal }, deletion };
}

/** The app (see `startAppWhereEveryStepTakesTheSameTime`) with a session that is up and waiting for its first message. */
export async function startAppWithAReadySession(
  options: {
    relayEnv?: Record<string, string>;
    script?: string;
    /** What the mock agent does, set before the session starts. */
    agent?: (agent: RunningApp["mockAgent"]) => void;
  } = {},
): Promise<{ app: RunningApp; session: Session }> {
  const app = await startAppWhereEveryStepTakesTheSameTime({ relayEnv: options.relayEnv ?? {} });
  if (options.script !== undefined) await theRepoRunsASetupScript(app, options.script);
  options.agent?.(app.mockAgent);
  const session = await startsASessionWithoutABranch(app);
  await app.streamed.waitFor(
    (event) => event.sessionId === session.id && event.kind === "agent-started",
    "expected the session to be ready",
  );
  return { app, session };
}

/** The folder of the session's worktree, from its `session-created` event. */
export async function worktreeFolderOf(app: AppAccess, session: Session): Promise<string> {
  const events = await app.sdk.sessions.events(session.id, { after: 0 });
  const created = events.find((event) => event.kind === "session-created");
  if (created?.kind !== "session-created") throw new Error("expected a session-created event");
  return created.payload.worktreePath;
}

/** The mock agent's process boots only when the test lets it, as an adapter that loads slowly does. */
export async function anAdapterThatBootsWhenTheTestLets(
  app: AppAccess,
): Promise<{ boots(): Promise<void> }> {
  const signal = join(await temporaryFolder("agentcontrol-slow-boot-"), "boot");
  app.mockAgent.bootsWhenFileExists(signal);
  const boots = () => Bun.write(signal, "").then(() => undefined);
  onTestEnd(boots);
  return { boots };
}

/** The user (or a crash) moved the session's folder away, as archiving does as its first step. */
export async function theWorktreeFolderIsMovedAway(
  app: AppAccess,
  session: Session,
): Promise<void> {
  const worktree = await worktreeFolderOf(app, session);
  await rename(worktree, `${worktree}.moved`);
}

/** The repo ignores `node_modules`, as every JavaScript project does. */
export async function theRepoIgnoresNodeModules(app: AppAccess): Promise<void> {
  await Bun.write(join(app.repoPath, ".gitignore"), ".env\nnode_modules\n");
  await git(app.repoPath, "commit", "-qam", "Ignore node_modules");
  // New sessions start from the remote's trunk, so the remote has to have it.
  await git(app.repoPath, "push", "-q", "origin", "main");
}
