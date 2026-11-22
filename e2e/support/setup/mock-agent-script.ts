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
  /** Asks to write the file (relative to its folder, absolute or even outside it), then writes it only if allowed. */
  willWriteFile(path: string, content: string): void;
  /** The agent says which launch-time settings (`_meta` of session/new) it was started with. */
  willEchoLaunchSettings(): void;
  /** The agent process dies in the middle of the turn. */
  willExitUnexpectedly(): void;
  /** Forgets every step so far, for a second agent process that must run a different script. */
  startsNewScript(): void;
  /** The agent reports compacting its context: an ACP update kind the relay does not interpret. */
  willCompactContext(): void;
  willFinishWith(stopReason: StopReason): void;
  /** The turn stays open until the user cancels it, then ends with stop reason `cancelled`. */
  willWaitUntilCancelled(): void;
  /** The turn stays open until a file exists at this path (the test creates it to let the agent go on). */
  willWaitForFile(path: string): void;
  /** The turn reports this usage, in a `usage_update` and in the prompt result, like the adapters. */
  willReportUsage(usage: ReportedUsage): void;
  /** Steps added after this call run on the next prompt instead of the current one. */
  onNextPrompt(): void;
  writeScript(): Promise<void>;
}

type ReportedUsage = Omit<Extract<Step, { kind: "reportUsage" }>, "kind">;

type ScriptedSteps = Omit<
  MockAgent,
  "dataFolder" | "scriptPath" | "onNextPrompt" | "writeScript" | "startsNewScript"
>;

function turnEndingSteps(
  add: (step: Step) => void,
): Pick<
  MockAgent,
  "willCompactContext" | "willFinishWith" | "willWaitUntilCancelled" | "willWaitForFile"
> {
  return {
    willWaitForFile: (path) => {
      add({ kind: "waitForFile", path });
    },
    willCompactContext: () => {
      add({ kind: "compactContext" });
    },
    willFinishWith: (stopReason) => {
      add({ kind: "finish", stopReason });
    },
    willWaitUntilCancelled: () => {
      add({ kind: "waitUntilCancelled" });
    },
  };
}

function fileSteps(
  add: (step: Step) => void,
): Pick<
  MockAgent,
  "willEditFile" | "willWriteFile" | "willEchoLaunchSettings" | "willExitUnexpectedly"
> {
  return {
    willEditFile: (path) => {
      add({ kind: "editFile", path, oldText: "// before\n", newText: "// after\n" });
    },
    willWriteFile: (path, content) => {
      add({ kind: "writeFile", path, content });
    },
    willEchoLaunchSettings: () => {
      add({ kind: "echoLaunchSettings" });
    },
    willExitUnexpectedly: () => {
      add({ kind: "exitUnexpectedly" });
    },
  };
}

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
    ...fileSteps(add),
    willAskToRunCommand: (command) => {
      add({ kind: "askToRunCommand", command });
    },
    ...turnEndingSteps(add),
    willReportUsage: (usage) => {
      add({ kind: "reportUsage", ...usage });
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
    startsNewScript: () => {
      script.turns.splice(0, script.turns.length, []);
    },
    writeScript: async () => {
      await Bun.write(scriptPath, JSON.stringify(script));
    },
  };
}
