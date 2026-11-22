import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MockAgentScript, Step, StopReason } from "../mock-agent/script.ts";
import { onTestEnd } from "./cleanup.ts";

export interface MockAgent {
  readonly dataFolder: string;
  readonly scriptPath: string;
  willReply(text: string): void;
  willThink(text: string): void;
  willPlan(...tasks: string[]): void;
  willEditFile(path: string): void;
  willAskToRunCommand(command: string): void;
  willFinishWith(stopReason: StopReason): void;
  /** Steps added after this call run on the next prompt instead of the current one. */
  onNextPrompt(): void;
  writeScript(): Promise<void>;
}

type ScriptedSteps = Pick<
  MockAgent,
  "willReply" | "willThink" | "willPlan" | "willEditFile" | "willAskToRunCommand" | "willFinishWith"
>;

function scriptedSteps(add: (step: Step) => void): ScriptedSteps {
  return {
    willReply: (text) => {
      add({ kind: "reply", text });
    },
    willThink: (text) => {
      add({ kind: "think", text });
    },
    willPlan: (...tasks) => {
      add({ kind: "plan", entries: tasks.map((content) => ({ content, status: "pending" })) });
    },
    willEditFile: (path) => {
      add({ kind: "editFile", path, oldText: "// before\n", newText: "// after\n" });
    },
    willAskToRunCommand: (command) => {
      add({ kind: "askToRunCommand", command });
    },
    willFinishWith: (stopReason) => {
      add({ kind: "finish", stopReason });
    },
  };
}

export async function createMockAgent(): Promise<MockAgent> {
  const dataFolder = await mkdtemp(join(tmpdir(), "agentcontrol-e2e-"));
  onTestEnd(() => rm(dataFolder, { recursive: true, force: true }));
  const script: MockAgentScript = { turns: [[]] };
  const scriptPath = join(dataFolder, "mock-agent-script.json");
  return {
    dataFolder,
    scriptPath,
    ...scriptedSteps((step) => {
      script.turns.at(-1)?.push(step);
    }),
    onNextPrompt: () => script.turns.push([]),
    writeScript: async () => {
      await Bun.write(scriptPath, JSON.stringify(script));
    },
  };
}
