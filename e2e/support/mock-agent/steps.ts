import { join } from "node:path";
import { methods, type SessionUpdate } from "@agentclientprotocol/sdk";
import { processSteps, writeFile } from "./file-steps.ts";
import type { Step, StopReason } from "./script.ts";
import { ALLOW_OR_REJECT, type Handler, send, type TurnContext } from "./turn.ts";

export type { TurnContext } from "./turn.ts";

const commandCallId = (command: string): string => `run-${command}`;

async function askUser(turn: TurnContext, command: string): Promise<boolean> {
  const response = await turn.client.request(methods.client.session.requestPermission, {
    sessionId: turn.sessionId,
    toolCall: {
      toolCallId: commandCallId(command),
      title: `Run ${command}`,
      kind: "execute",
      rawInput: { command },
    },
    options: ALLOW_OR_REJECT,
  });
  return response.outcome.outcome === "selected" && response.outcome.optionId === "allow";
}

const reply: Handler<"reply"> = async (step, turn) => {
  await send(turn, {
    sessionUpdate: "agent_message_chunk",
    content: { type: "text", text: step.text },
  });
  return undefined;
};

const think: Handler<"think"> = async (step, turn) => {
  await send(turn, {
    sessionUpdate: "agent_thought_chunk",
    content: { type: "text", text: step.text },
  });
  return undefined;
};

const plan: Handler<"plan"> = async (step, turn) => {
  const entries = step.entries.map((e) => ({ ...e, priority: "medium" as const }));
  await send(turn, { sessionUpdate: "plan", entries });
  return undefined;
};

const editFile: Handler<"editFile"> = async (step, turn) => {
  const toolCallId = `edit-${step.path}`;
  const diff = {
    type: "diff" as const,
    path: step.path,
    oldText: step.oldText,
    newText: step.newText,
  };
  const locations = [{ path: step.path }];
  const title = `Edit ${step.path}`;
  await Bun.write(join(turn.cwd, step.path), step.newText);
  await send(turn, {
    sessionUpdate: "tool_call",
    toolCallId,
    title,
    kind: "edit",
    status: "in_progress",
    content: [diff],
    locations,
  });
  await send(turn, {
    sessionUpdate: "tool_call_update",
    toolCallId,
    status: "completed",
    content: [diff],
  });
  return undefined;
};

const askToRunCommand: Handler<"askToRunCommand"> = async (step, turn) => {
  const toolCallId = commandCallId(step.command);
  const rawInput = { command: step.command };
  await send(turn, {
    sessionUpdate: "tool_call",
    toolCallId,
    title: `Run ${step.command}`,
    kind: "execute",
    status: "pending",
    rawInput,
  });
  const allowed = !turn.asksBeforeActing || (await askUser(turn, step.command));
  const status = allowed ? "completed" : "failed";
  await send(turn, { sessionUpdate: "tool_call_update", toolCallId, status });
  return allowed ? undefined : "end_turn";
};

/** An update kind the relay does not interpret, so tests can see it arrive as "other". */
const compactContext: Handler<"compactContext"> = async (_step, turn) => {
  await send(turn, {
    sessionUpdate: "compaction_update",
    compactionId: "compaction-1",
    status: "completed",
  });
  return undefined;
};

/** Sends the update exactly as scripted, shaped like a real adapter's or a misbehaving one's. */
const sendUpdate: Handler<"sendUpdate"> = async (step, turn) => {
  await send(turn, step.update as SessionUpdate);
  return undefined;
};

const finish: Handler<"finish"> = (step) => Promise.resolve(step.stopReason);

const waitUntilCancelled: Handler<"waitUntilCancelled"> = async (_step, turn) => {
  await turn.cancelled;
  return "cancelled";
};

/** Shaped like the real adapters: a `usage_update` with the model in `_meta` and a cumulative cost. */
const reportUsage: Handler<"reportUsage"> = async (step, turn) => {
  await send(turn, {
    sessionUpdate: "usage_update",
    used: step.inputTokens + step.outputTokens,
    size: 200000,
    cost: { amount: step.costUsd, currency: "USD" },
    _meta: { "_claude/model": step.model },
  });
  return undefined;
};

const handlers: { [K in Step["kind"]]: Handler<K> } = {
  reply,
  think,
  plan,
  editFile,
  askToRunCommand,
  writeFile,
  ...processSteps,
  compactContext,
  sendUpdate,
  finish,
  waitUntilCancelled,
  reportUsage,
};

export function runStep(step: Step, turn: TurnContext): Promise<StopReason | undefined> {
  const handle = handlers[step.kind] as Handler<Step["kind"]>;
  return handle(step, turn);
}
