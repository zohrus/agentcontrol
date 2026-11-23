import { once } from "node:events";
import { homedir } from "node:os";
import { type AgentKind, type CheckStep as CheckStepSchema } from "@agentcontrol/protocol";
import type { z } from "zod";
import { availableAgents, type HostEnv, startAgent } from "../agents/index.ts";

type CheckStep = z.infer<typeof CheckStepSchema>;

const DEFAULT_TIMEOUT_MS = 20_000;

/** How long an agent may take to answer: 20 seconds, or AGENTCONTROL_AGENT_CHECK_TIMEOUT_MS. */
const timeoutIn = (env: HostEnv): number =>
  Number(env["AGENTCONTROL_AGENT_CHECK_TIMEOUT_MS"] ?? DEFAULT_TIMEOUT_MS);

const LABELS: Record<AgentKind, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  mock: "Mock agent",
};

/** Starts the agent and stops it again: it must answer ACP `initialize` and `session/new`. */
async function handshake(kind: AgentKind, hostEnv: HostEnv): Promise<void> {
  const started = startAgent({
    kind,
    cwd: homedir(),
    env: {},
    hostEnv,
    onMessage: () => undefined,
    onPermissionRequest: () => Promise.resolve({ cancelled: true }),
  });
  const limit = timeoutIn(hostEnv);
  const timedOut = once(AbortSignal.timeout(limit), "abort").then(() => {
    throw new Error(`it did not answer within ${String(limit / 1000)} seconds`);
  });
  void started.then(
    (late) => late.stop(),
    () => undefined,
  );
  const agent = await Promise.race([started, timedOut]);
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
