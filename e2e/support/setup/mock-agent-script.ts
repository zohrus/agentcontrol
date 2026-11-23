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
  /** The agent reads this file: a one-line read tool call. */
  willReadFile(path: string): void;
  /** The agent searches the code: a one-line search tool call. */
  willSearchFor(query: string): void;
  /** The agent switches to this mode (for example "plan"). */
  willChangeModeTo(modeId: string): void;
  /** The agent tells the user something without being asked: a muted line in the conversation. */
  willShowNotice(title: string, description?: string): void;
  /** Forgets every step so far, for a second agent process that must run a different script. */
  startsNewScript(): void;
  /** The agent reports compacting its context: an ACP update kind the relay does not interpret. */
  willCompactContext(): void;
  /** The agent sends this `session/update` as it is, for update kinds the other steps do not cover. */
  willSendUpdate(update: Record<string, unknown>): void;
  willFinishWith(stopReason: StopReason): void;
  /** The turn stays open until the user cancels it, then ends with stop reason `cancelled`. */
  willWaitUntilCancelled(): void;
  /** The turn reports this usage, in a `usage_update` and in the prompt result, like the adapters. */
  willReportUsage(usage: ReportedUsage): void;
  /**
   * The agent behaves like the Claude Code adapter: it offers the same permission modes, starts in
   * this one, and asks before running a command only in "default" (Manual).
   */
  startsInMode(modeId: string): void;
  /** The request to change the mode is refused, as when the user's Claude Code policy forbids it. */
  refusesToChangeMode(): void;
  /** Steps added after this call run on the next prompt instead of the current one. */
  onNextPrompt(): void;
  writeScript(): Promise<void>;
}

type ReportedUsage = Omit<Extract<Step, { kind: "reportUsage" }>, "kind">;

type ScriptedSteps = Omit<
  MockAgent,
  | "dataFolder"
  | "scriptPath"
  | "onNextPrompt"
  | "writeScript"
  | "startsNewScript"
  | "startsInMode"
  | "refusesToChangeMode"
>;

function streamLineSteps(
  add: (step: Step) => void,
): Pick<MockAgent, "willReadFile" | "willSearchFor" | "willChangeModeTo" | "willShowNotice"> {
  return {
    willReadFile: (path) => {
      add({ kind: "readFile", path });
    },
    willSearchFor: (query) => {
      add({ kind: "searchFor", query });
    },
    willChangeModeTo: (modeId) => {
      add({ kind: "changeMode", modeId });
    },
    willShowNotice: (title, description) => {
      add(
        description === undefined
          ? { kind: "showNotice", title }
          : { kind: "showNotice", title, description },
      );
    },
  };
}

function turnEndingSteps(
  add: (step: Step) => void,
): Pick<
  MockAgent,
  "willCompactContext" | "willSendUpdate" | "willFinishWith" | "willWaitUntilCancelled"
> {
  return {
    willCompactContext: () => {
      add({ kind: "compactContext" });
    },
    willSendUpdate: (update) => {
      add({ kind: "sendUpdate", update });
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
    ...streamLineSteps(add),
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
    startsInMode: (modeId) => {
      script.startsInMode = modeId;
    },
    refusesToChangeMode: () => {
      script.refusesModeChange = true;
    },
    onNextPrompt: () => script.turns.push([]),
    startsNewScript: () => {
      script.turns.splice(0, script.turns.length, []);
    },
    writeScript: async () => {
      await Bun.write(scriptPath, JSON.stringify(script));
    },
  };
}
