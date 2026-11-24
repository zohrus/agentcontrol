import { methods } from "@agentclientprotocol/sdk";
import { bootAgent, startFailed } from "./boot.ts";
import type { Connection } from "./connect.ts";
import { type Opened, openAgentSession } from "./handshake.ts";
import type { SpawnedAgent } from "./spawn.ts";
import { stopProcess } from "./stop.ts";
import type { AgentProcess, PreparedAgent, StartAgentOptions } from "./types.ts";

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
      await stopProcess(spawned);
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

/**
 * Spawns the adapter and runs `initialize`: everything that does not need the session's folder, so
 * it can overlap with making the folder. `open` then runs session/new (or session/load, to continue
 * the session `resume` names) and returns once the agent is ready for a prompt.
 */
export async function prepareAgent(options: StartAgentOptions): Promise<PreparedAgent> {
  const { spawned, canLoad, command, connection, drained, replay } = await bootAgent(options);
  return {
    discard: () => stopProcess(spawned),
    open: async (call) => {
      const opening = { ...options, ...call };
      try {
        const opened = await openAgentSession(connection, { options: opening, canLoad, replay });
        return agentProcess({ spawned, connection, drained, opened });
      } catch (error) {
        throw await startFailed({ command, error, spawned });
      }
    },
  };
}

/** Spawns the adapter, runs initialize and session/new (or session/load), and returns once it is ready for a prompt. */
export async function startAgent(options: StartAgentOptions): Promise<AgentProcess> {
  const prepared = await prepareAgent(options);
  const { resume, sessionMeta } = options;
  return prepared.open({
    cwd: options.cwd,
    ...(resume ? { resume } : {}),
    ...(sessionMeta ? { sessionMeta } : {}),
  });
}
