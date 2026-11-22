import { type AgentContext, methods, type SessionUpdate } from "@agentclientprotocol/sdk";
import type { Step, StopReason } from "./script.ts";

export interface TurnContext {
  readonly client: AgentContext;
  readonly sessionId: string;
}

/** A handler returns a stop reason to end the turn early, or nothing to carry on. */
type Handler<K extends Step["kind"]> = (
  step: Extract<Step, { kind: K }>,
  turn: TurnContext,
) => Promise<StopReason | undefined>;

async function send(turn: TurnContext, update: SessionUpdate): Promise<void> {
  await turn.client.notify(methods.client.session.update, { sessionId: turn.sessionId, update });
}

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
    options: [
      { optionId: "allow", name: "Allow", kind: "allow_once" },
      { optionId: "reject", name: "Reject", kind: "reject_once" },
    ],
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
  const allowed = await askUser(turn, step.command);
  const status = allowed ? "completed" : "failed";
  await send(turn, { sessionUpdate: "tool_call_update", toolCallId, status });
  return allowed ? undefined : "end_turn";
};

const finish: Handler<"finish"> = (step) => Promise.resolve(step.stopReason);

const handlers: { [K in Step["kind"]]: Handler<K> } = {
  reply,
  think,
  plan,
  editFile,
  askToRunCommand,
  finish,
};

export function runStep(step: Step, turn: TurnContext): Promise<StopReason | undefined> {
  const handle = handlers[step.kind] as Handler<Step["kind"]>;
  return handle(step, turn);
}
