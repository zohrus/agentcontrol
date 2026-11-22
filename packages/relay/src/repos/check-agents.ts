import { homedir } from "node:os";
import { type AgentKind, type CheckStep as CheckStepSchema } from "@agentcontrol/protocol";
import type { z } from "zod";
import { availableAgents, type HostEnv, startAgent } from "../agents/index.ts";

type CheckStep = z.infer<typeof CheckStepSchema>;

const HANDSHAKE_TIMEOUT_MS = 20_000;

const LABELS: Record<AgentKind, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  mock: "Mock agent",
};

/** Starts the agent and stops it again: it must answer ACP `initialize` and `session/new`. */
async function handshake(kind: AgentKind, hostEnv: HostEnv): Promise<void> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("it did not answer within 20 seconds"));
    }, HANDSHAKE_TIMEOUT_MS).unref();
  });
  const started = startAgent({
    kind,
    cwd: homedir(),
    env: {},
    hostEnv,
    onMessage: () => undefined,
    onPermissionRequest: () => Promise.resolve({ cancelled: true }),
  });
  const agent = await Promise.race([started, timeout]);
  await agent.stop();
}

async function agentStep(kind: AgentKind, hostEnv: HostEnv): Promise<CheckStep> {
  const base = { id: `agent-${kind}`, label: `${LABELS[kind]} starts and answers` };
  try {
    await handshake(kind, hostEnv);
    return { ...base, status: "ok", detail: "The ACP handshake worked." };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ...base, status: "failed", detail };
  }
}

/** One step per agent this machine is set up to run: an ACP handshake, with no prompt sent. */
export function checkAgents(hostEnv: HostEnv): Promise<CheckStep[]> {
  return Promise.all(availableAgents(hostEnv).map((kind) => agentStep(kind, hostEnv)));
}
