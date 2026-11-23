import { methods } from "@agentclientprotocol/sdk";
import { z } from "zod";
import { type Logger, logStream } from "../../spike/message-log.ts";
import { connectClient, initialize, runPrompt } from "../../spike/run-session.ts";
import { spawnAdapter } from "../../spike/spawn-adapter.ts";

export interface ResumeFinding {
  /** Whether the adapter offers `session/load` at all. */
  offered: boolean;
  /** Messages the adapter sent while loading (the replayed history). */
  replayed: number;
  stopReason: string;
  /** What the agent said when asked about the earlier work. */
  answer: string;
}

const QUESTION = "In five words or fewer: what did you change in greeting.js?";

const Chunk = z.looseObject({
  params: z.looseObject({
    update: z.looseObject({
      sessionUpdate: z.literal("agent_message_chunk"),
      content: z.looseObject({ text: z.string() }),
    }),
  }),
});

function chunkText(message: unknown): string {
  const chunk = Chunk.safeParse(message);
  return chunk.success ? chunk.data.params.update.content.text : "";
}

/** Collects what the agent sends, so the probe can read it afterwards. */
function collector(): { heard: unknown[]; log: Logger } {
  const heard: unknown[] = [];
  const log: Logger = (dir, message) => {
    if (dir === "agent->client") heard.push(message);
  };
  return { heard, log };
}

/**
 * Starts a fresh adapter process, loads the old agent session by its id (what the relay would do
 * after a restart) and asks one question about the earlier work. Reports; it builds nothing.
 */
export async function probeSessionLoad(old: {
  sessionId: string;
  cwd: string;
}): Promise<ResumeFinding> {
  const { heard, log } = collector();
  const adapter = spawnAdapter("claude", old.cwd);
  const conn = connectClient(logStream(adapter.stream, log), log);
  try {
    const init = await initialize(conn);
    await conn.agent.request(methods.agent.session.load, { ...old, mcpServers: [] });
    const replayed = heard.length;
    const stopReason = await runPrompt(conn, { sessionId: old.sessionId, prompt: QUESTION });
    const answer = heard.slice(replayed).map(chunkText).join("");
    return { offered: init.agentCapabilities?.loadSession === true, replayed, stopReason, answer };
  } finally {
    conn.close();
    adapter.child.kill();
  }
}
