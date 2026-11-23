import type { CheckStep as CheckStepSchema } from "@agentcontrol/protocol";
import type { z } from "zod";
import type { HostEnv } from "../agents/index.ts";

type CheckStep = z.infer<typeof CheckStepSchema>;

/** Tests (and anyone with an unusual install) name the whole command here, as for agents. */
const OVERRIDE = "AGENTCONTROL_CODE_SERVER_CMD";
const VERSION_TIMEOUT_MS = 15_000;

/** Where a person installs it; shown when code-server is missing. */
export const INSTALL_HINT = "curl -fsSL https://code-server.dev/install.sh | sh";

function parseOverride(text: string): string[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed) || !parsed.every((part) => typeof part === "string")) {
    throw new Error(`${OVERRIDE} must be a JSON array of strings, like ["bun", "code-server.ts"]`);
  }
  return parsed;
}

/**
 * The command that starts code-server on this machine, or undefined when there is none. It is the
 * user's own tool, found on the relay's PATH (which on an ssh workspace is the user's login-shell
 * PATH, as for agents). It is never downloaded or installed by AgentControl.
 */
function codeServerCommand(env: HostEnv): string[] | undefined {
  const override = env[OVERRIDE];
  if (override) return parseOverride(override);
  const found = Bun.which("code-server", { PATH: env["PATH"] ?? "" });
  return found === null ? undefined : [found];
}

/** What running `code-server --version` shows; undefined when it does not run or prints no version. */
async function versionOf(command: string[], env: HostEnv): Promise<string | undefined> {
  try {
    const run = Bun.spawn([...command, "--version"], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "ignore",
      env: Object.fromEntries(Object.entries(env).filter((entry) => entry[1] !== undefined)),
      signal: AbortSignal.timeout(VERSION_TIMEOUT_MS),
    });
    const text = await new Response(run.stdout).text();
    return /^\d+\.\d+\.\d+\S*/.exec(text.trim())?.[0];
  } catch {
    return undefined;
  }
}

export interface CodeServerFound {
  command: string[];
  version: string;
}

/** The installed code-server and its version, or undefined when it is not installed (or broken). */
export async function detectCodeServer(env: HostEnv): Promise<CodeServerFound | undefined> {
  const command = codeServerCommand(env);
  if (command === undefined) return undefined;
  const version = await versionOf(command, env);
  return version === undefined ? undefined : { command, version };
}

/** The optional line of the workspace checklist: never a failure, it is not needed. */
export async function codeServerStep(env: HostEnv): Promise<CheckStep> {
  const base = { id: "code-server", label: "code-server (browser VS Code)" };
  const found = await detectCodeServer(env);
  if (found !== undefined) return { ...base, status: "ok", detail: `found ${found.version}` };
  const detail = `not installed (optional): install it with ${INSTALL_HINT}`;
  return { ...base, status: "skipped", detail };
}
