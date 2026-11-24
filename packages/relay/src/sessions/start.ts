import { runSetupScript } from "../worktrees/index.ts";
import { archivedMeanwhile, bootAgent, discardBooted, openBooted } from "./boot-agent.ts";
import type { Booted } from "./boot-agent.ts";
import type { SessionContext } from "./context.ts";
import { makeWorktreeAndShare, type NewSession, reasonOf } from "./make-worktree.ts";
import { startTurn } from "./turn.ts";

/** The setup script ended with an exit code other than 0. */
class ScriptFailed extends Error {
  readonly exitCode: number;
  constructor(exitCode: number) {
    super(`The setup script exited with ${String(exitCode)}.`);
    this.exitCode = exitCode;
  }
}

/** Runs the setup script as a timed step; its exit code. A script that cannot run counts as 1. */
async function runScript(ctx: SessionContext, session: NewSession): Promise<number> {
  const { sessionId, repo, worktree, timed } = session;
  const script = {
    id: "script",
    doing: "Running the setup script",
    done: "Ran the setup script",
  };
  const run = async (): Promise<number> => {
    const exitCode = await runSetupScript({
      script: repo.setup.setupScript,
      cwd: worktree.worktreePath,
      env: worktree.env,
      onOutput: (stream, text) => {
        ctx.record(sessionId, { kind: "setup-output", payload: { stream, text } });
      },
    });
    if (exitCode !== 0) throw new ScriptFailed(exitCode);
    return exitCode;
  };
  const hasScript = (repo.setup.setupScript ?? "").trim() !== "";
  return (hasScript ? timed(script, run) : run()).catch(async (error: unknown) => {
    if (error instanceof ScriptFailed) return error.exitCode;
    const text = `${reasonOf(error)}\n`;
    await ctx.log.append(sessionId, { kind: "setup-output", payload: { stream: "stderr", text } });
    return 1;
  });
}

/** Runs the repo's setup script in the new worktree; true when it succeeded. */
async function runSetup(ctx: SessionContext, session: NewSession): Promise<boolean> {
  const exitCode = await runScript(ctx, session);
  await ctx.log.append(session.sessionId, { kind: "setup-finished", payload: { exitCode } });
  return exitCode === 0;
}

/** Opens the agent's session in the made worktree, with the first prompt as its first turn when there is one. */
async function startAgentOf(
  ctx: SessionContext,
  call: { session: NewSession; booting: Promise<Booted> },
): Promise<void> {
  const { sessionId } = call.session;
  const agent = await openBooted(ctx, call);
  if (!agent) return;
  if (archivedMeanwhile(ctx, sessionId)) {
    await agent.stop();
    return;
  }
  const { prompt } = call.session.params;
  if (prompt !== undefined) await startTurn(ctx, { sessionId, agent, text: prompt });
}

/**
 * The agent's process starts and says `initialize` while git makes the worktree and the setup
 * script runs; once the folder is ready the agent opens its session in it.
 */
async function runSession(ctx: SessionContext, session: NewSession): Promise<void> {
  const booting = bootAgent(ctx, session);
  const ready = (await makeWorktreeAndShare(ctx, session)) && (await runSetup(ctx, session));
  if (!ready) return discardBooted(ctx, { sessionId: session.sessionId, booting });
  await startAgentOf(ctx, { session, booting });
}

/** Runs everything after the session exists; every failure ends up as events in the log. */
export function runInBackground(ctx: SessionContext, session: NewSession): void {
  const unexpected = `Session ${session.sessionId} failed unexpectedly:`;
  runSession(ctx, session).catch(console.error.bind(console, unexpected));
}
