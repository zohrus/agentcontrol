import {
  client,
  methods,
  PROTOCOL_VERSION,
  type RequestPermissionRequest,
} from "@agentclientprotocol/sdk";
import { commandFor } from "./commands.ts";
import { modeToSwitchTo } from "./modes.ts";
import { type SpawnedAgent, spawnAgent } from "./spawn.ts";
import { tapStream } from "./tap.ts";
import type { AgentProcess, PermissionAnswer, StartAgentOptions } from "./types.ts";

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

function connectTo(spawned: SpawnedAgent, options: StartAgentOptions) {
  const stream = tapStream(spawned.stream, options.onMessage);
  return client({ name: "agentcontrol-relay" })
    .onNotification(methods.client.session.update, () => undefined)
    .onRequest(methods.client.session.requestPermission, ({ params }) =>
      askPermission(params, options),
    )
    .connect(stream);
}

type Connection = ReturnType<typeof connectTo>;

/** Puts the agent in the mode that makes it ask; failing is loud, since it would otherwise never ask. */
async function switchMode(
  connection: Connection,
  change: { sessionId: string; modeId: string },
): Promise<void> {
  await connection.agent.request(methods.agent.session.setMode, change).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`the agent would not switch to its "${change.modeId}" mode (${reason})`);
  });
}

async function handshake(connection: Connection, options: StartAgentOptions): Promise<string> {
  await connection.agent.request(methods.agent.initialize, {
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: {},
  });
  const { sessionId, modes } = await connection.agent.request(methods.agent.session.new, {
    cwd: options.cwd,
    mcpServers: [],
    ...(options.sessionMeta ? { _meta: options.sessionMeta } : {}),
  });
  const modeId = modeToSwitchTo(options.kind, modes);
  if (modeId !== undefined) await switchMode(connection, { sessionId, modeId });
  return sessionId;
}

function agentProcess(parts: { spawned: SpawnedAgent; connection: Connection; sessionId: string }) {
  const { spawned, connection, sessionId } = parts;
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
    },
    exited: spawned.exited,
  };
  return agent;
}

function failure(command: string[], reason: unknown, spawned?: SpawnedAgent): Error {
  const detail = reason instanceof Error ? reason.message : String(reason);
  const stderr = spawned?.stderrTail();
  const output = stderr ? `\nThe agent said:\n${stderr}` : "";
  return new Error(`Could not start the agent with \`${command.join(" ")}\`: ${detail}${output}`);
}

/** Spawns the adapter, runs initialize and session/new, and returns once it is ready for a prompt. */
export async function startAgent(options: StartAgentOptions): Promise<AgentProcess> {
  const command = commandFor(options.kind, options.hostEnv);
  if (!command) throw new Error(`The "${options.kind}" agent is not configured on this machine.`);
  let spawned: SpawnedAgent | undefined;
  try {
    spawned = spawnAgent({
      command,
      cwd: options.cwd,
      env: { ...options.hostEnv, ...options.env },
    });
    const connection = connectTo(spawned, options);
    const sessionId = await handshake(connection, options);
    return agentProcess({ spawned, connection, sessionId });
  } catch (error) {
    spawned?.kill();
    await spawned?.exited;
    throw failure(command, error, spawned);
  }
}
