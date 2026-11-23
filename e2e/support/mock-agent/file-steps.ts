import { resolve } from "node:path";
import { methods } from "@agentclientprotocol/sdk";
import { ALLOW_OR_REJECT, type Handler, send, type TurnContext } from "./turn.ts";

async function askToWrite(turn: TurnContext, call: { path: string; content: string }) {
  const { path, content } = call;
  const response = await turn.client.request(methods.client.session.requestPermission, {
    sessionId: turn.sessionId,
    toolCall: {
      toolCallId: `write-${path}`,
      title: `Write ${path}`,
      kind: "edit",
      locations: [{ path }],
      content: [{ type: "diff", path, oldText: "", newText: content }],
      rawInput: { file_path: path },
    },
    options: ALLOW_OR_REJECT,
  });
  return response.outcome.outcome === "selected" && response.outcome.optionId === "allow";
}

/** Asks to edit a file (relative to the cwd, absolute, or outside it); writes only if allowed. */
export const writeFile: Handler<"writeFile"> = async (step, turn) => {
  const path = resolve(turn.cwd, step.path);
  const allowed = await askToWrite(turn, { path, content: step.content });
  if (allowed) await Bun.write(path, step.content);
  const status = allowed ? "completed" : "failed";
  await send(turn, {
    sessionUpdate: "tool_call",
    toolCallId: `write-${path}`,
    title: `Write ${path}`,
    kind: "edit",
    status,
    locations: [{ path }],
    content: [{ type: "diff", path, oldText: null, newText: step.content }],
  });
  return undefined;
};

/** Says which launch-time settings the client sent, so tests can see what the adapter would get. */
const echoLaunchSettings: Handler<"echoLaunchSettings"> = async (_step, turn) => {
  const text = `launch settings: ${JSON.stringify(turn.launchSettings ?? null)}`;
  await send(turn, { sessionUpdate: "agent_message_chunk", content: { type: "text", text } });
  return undefined;
};

/** The agent process dies in the middle of the turn. */
const exitUnexpectedly: Handler<"exitUnexpectedly"> = () => {
  process.exit(3);
};

/** Runs a shell command in the working folder, as an agent's shell tool does, and tells what it printed. */
const runCommand: Handler<"runCommand"> = async (step, turn) => {
  const ran = Bun.spawn(["sh", "-c", step.command], {
    cwd: turn.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(ran.stdout).text();
  const err = await new Response(ran.stderr).text();
  const text = `ran \`${step.command}\`:\n${out}${err}`;
  await send(turn, { sessionUpdate: "agent_message_chunk", content: { type: "text", text } });
  return undefined;
};

export const processSteps = { echoLaunchSettings, exitUnexpectedly, runCommand };
