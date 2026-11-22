import { z } from "zod";

const planStatus = z.enum(["pending", "in_progress", "completed"]);
const stopReason = z.enum(["end_turn", "max_tokens", "max_turn_requests", "refusal", "cancelled"]);

const stepSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("reply"), text: z.string() }),
  z.object({ kind: z.literal("think"), text: z.string() }),
  z.object({
    kind: z.literal("plan"),
    entries: z.array(z.object({ content: z.string(), status: planStatus })),
  }),
  z.object({
    kind: z.literal("editFile"),
    path: z.string(),
    oldText: z.string(),
    newText: z.string(),
  }),
  z.object({ kind: z.literal("askToRunCommand"), command: z.string() }),
  z.object({ kind: z.literal("writeFile"), path: z.string(), content: z.string() }),
  z.object({ kind: z.literal("echoLaunchSettings") }),
  z.object({ kind: z.literal("exitUnexpectedly") }),
  z.object({ kind: z.literal("compactContext") }),
  z.object({ kind: z.literal("finish"), stopReason }),
  z.object({ kind: z.literal("waitUntilCancelled") }),
  z.object({
    kind: z.literal("reportUsage"),
    model: z.string(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    cachedReadTokens: z.number(),
    cachedWriteTokens: z.number(),
    costUsd: z.number(),
  }),
]);

/** One list of steps per prompt turn: the first prompt runs turn 0, the second turn 1, and so on. */
const scriptSchema = z.object({ turns: z.array(z.array(stepSchema)) });

export type Step = z.infer<typeof stepSchema>;
export type MockAgentScript = z.infer<typeof scriptSchema>;
export type StopReason = z.infer<typeof stopReason>;

export async function loadScript(path: string): Promise<MockAgentScript> {
  return scriptSchema.parse(await Bun.file(path).json());
}
