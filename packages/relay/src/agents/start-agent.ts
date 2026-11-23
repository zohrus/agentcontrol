import { client, methods, type RequestPermissionRequest } from "@agentclientprotocol/sdk";
import { launchFor } from "./commands.ts";
import { agentEnvironment } from "./environment.ts";
import { handshake, type Opened, type Replay } from "./handshake.ts";
import { type SpawnedAgent, spawnAgent } from "./spawn.ts";
import { tapStream } from "./tap.ts";
import type {
  AgentProcess,
  MessageDirection,
  PermissionAnswer,
  StartAgentOptions,
} from "./types.ts";

function toOutcome(answer: PermissionAnswer) {
  return "optionId" in answer
    ? { outcome: "selected" as const, optionId: answer.optionId }
    : { outcome: "cancelled" as const };
}

async function askPermission(params: RequestPermissionRequest, options: StartAgentOptions) {
  const answer = await options.onPermissionRequest({
    requestId: crypto.randomUUID(),
    toolCall: params.toolCall,
    options: params.options.map(({ optionId, name, kind }) => ({ optionId, name, kind })),
  });
  return { outcome: toOutcome(answer) };
}

const isUpdate = (message: unknown): boolean =>
  typeof message === "object" &&
  message !== null &&
  "method" in message &&
  message.method === methods.client.session.update;

/** Reports every message, except the history a loaded session replays: that was logged live once. */
function reportingTo(options: StartAgentOptions, replay: Replay) {
  return (direction: MessageDirection, message: unknown): void => {
    if (replay.active && direction === "from-agent" && isUpdate(message)) return;
    options.onMessage(direction, message);
  };
}

function connectTo(spawned: SpawnedAgent, options: StartAgentOptions) {
  const replay: Replay = { active: false };
  const { stream, drained } = tapStream(spawned.stream, reportingTo(options, replay));
  const connection = client({ name: "agentcontrol-relay" })
    .onNotification(methods.client.session.update, () => undefined)
    .onRequest(methods.client.session.requestPermission, ({ params }) =>
      askPermission(params, options),
    )
    .connect(stream);
  return { connection, drained, replay };
}

type Connection = ReturnType<typeof connectTo>["connection"];

/** How long a stopped agent's last messages may take to be reported before they are given up on. */
const DRAIN_MS = 100;

function agentProcess(parts: {
  spawned: SpawnedAgent;
  connection: Connection;
  drained: Promise<void>;
  opened: Opened;
}) {
  const { spawned, connection, drained, opened } = parts;
  const { sessionId } = opened;
  const agent: AgentProcess = {
    prompt: async (text) => {
      const { stopReason } = await connection.agent.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: "text", text }],
      });
      return { stopReason };
    },
    cancel: () => connection.agent.notify(methods.agent.session.cancel, { sessionId }),
    stop: async () => {
      spawned.kill();
      await spawned.exited;
      // What the agent said just before it stopped is still on its way: wait until it is reported.
      await Promise.race([drained, Bun.sleep(DRAIN_MS)]);
    },
    exited: spawned.exited,
    agentSessionId: sessionId,
    restored: opened.restored,
    notRestoredBecause: opened.notRestoredBecause,
  };
  return agent;
}

function failure(command: string[], reason: unknown, spawned?: SpawnedAgent): Error {
  const detail = reason instanceof Error ? reason.message : String(reason);
  const stderr = spawned?.stderrTail();
  const output = stderr ? `\nThe agent said:\n${stderr}` : "";
  return new Error(`Could not start the agent with \`${command.join(" ")}\`: ${detail}${output}`);
}

/**
 * Spawns the adapter, runs initialize and session/new (or session/load, to continue the session
 * `options.resume` names), and returns once it is ready for a prompt.
 */
export async function startAgent(options: StartAgentOptions): Promise<AgentProcess> {
  const launch = await launchFor(options.kind, options.hostEnv);
  if (!launch) throw new Error(`The "${options.kind}" agent is not configured on this machine.`);
  const { command } = launch;
  let spawned: SpawnedAgent | undefined;
  try {
    spawned = spawnAgent({
      command,
      cwd: options.cwd,
      env: { ...agentEnvironment(options.hostEnv), ...launch.env, ...options.env },
    });
    const { connection, drained, replay } = connectTo(spawned, options);
    const opened = await handshake(connection, { options, replay });
    return agentProcess({ spawned, connection, drained, opened });
  } catch (error) {
    spawned?.kill();
    await spawned?.exited;
    throw failure(command, error, spawned);
  }
}
