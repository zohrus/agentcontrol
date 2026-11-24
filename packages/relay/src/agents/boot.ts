import { untimed } from "../steps/index.ts";
import { ADAPTERS } from "./adapters.ts";
import { type Launch, launchFor } from "./commands.ts";
import { connectTo } from "./connect.ts";
import { agentEnvironment } from "./environment.ts";
import { initializeAgent } from "./handshake.ts";
import { type SpawnedAgent, spawnAgent } from "./spawn.ts";
import { stopProcess } from "./stop.ts";
import type { StartAgentOptions } from "./types.ts";

function failure(command: string[], reason: unknown, spawned?: SpawnedAgent): Error {
  const detail = reason instanceof Error ? reason.message : String(reason);
  const stderr = spawned?.stderrTail();
  const output = stderr ? `\nThe agent said:\n${stderr}` : "";
  return new Error(`Could not start the agent with \`${command.join(" ")}\`: ${detail}${output}`);
}

/** The error that says why starting the agent did not work, after the process was ended. */
export async function startFailed(call: {
  command: string[];
  error: unknown;
  spawned: SpawnedAgent | undefined;
}): Promise<Error> {
  const { command, error, spawned } = call;
  if (spawned) await stopProcess(spawned);
  return failure(command, error, spawned);
}

async function launchOf(options: StartAgentOptions): Promise<Launch> {
  const { kind, hostEnv, timed } = options;
  const launch = await launchFor({ kind, env: hostEnv, timed: timed ?? untimed });
  if (!launch) throw new Error(`The "${kind}" agent is not configured on this machine.`);
  return launch;
}

/** Spawns the process and runs ACP `initialize` over it. */
async function spawnAndInitialize(options: StartAgentOptions, launch: Launch) {
  const { command } = launch;
  const env = { ...agentEnvironment(options.hostEnv), ...launch.env, ...options.env };
  const spawned = spawnAgent({ command, cwd: options.cwd, env });
  const connected = connectTo(spawned, options);
  try {
    const canLoad = await initializeAgent(connected.connection);
    return { spawned, canLoad, command, ...connected };
  } catch (error) {
    throw await startFailed({ command, error, spawned });
  }
}

/** Starts the adapter process and runs `initialize`, the part of starting that needs no folder. */
export async function bootAgent(options: StartAgentOptions) {
  const launch = await launchOf(options);
  const label = ADAPTERS[options.kind]?.label ?? options.kind;
  const step = {
    id: "agent-start",
    doing: `Starting the ${label} adapter`,
    done: `Started the ${label} adapter`,
  };
  return (options.timed ?? untimed)(step, () => spawnAndInitialize(options, launch));
}
