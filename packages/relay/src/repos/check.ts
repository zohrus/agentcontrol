import { statfs } from "node:fs/promises";
import { homedir } from "node:os";
import type { CheckStep as CheckStepSchema } from "@agentcontrol/protocol";
import type { z } from "zod";
import type { HostEnv } from "../agents/index.ts";
import { runGit } from "../git/index.ts";

type CheckStep = z.infer<typeof CheckStepSchema>;

const MIN_FREE_GB = 5;
const MIN_GIT: [number, number] = [2, 25];

function osStep(): CheckStep {
  const detail = `${process.platform} ${process.arch}`;
  return { id: "os", label: "Operating system", status: "ok", detail };
}

/** Free space where the home folder of the relay's environment lives. */
async function diskStep(env: HostEnv): Promise<CheckStep> {
  const label = "Free disk space";
  try {
    const stats = await statfs(env["HOME"] ?? homedir());
    const freeGb = (stats.bavail * stats.bsize) / 1024 ** 3;
    const enough = freeGb >= MIN_FREE_GB;
    const needed = enough ? "" : `; at least ${String(MIN_FREE_GB)} GB is needed.`;
    const detail = `${freeGb.toFixed(1)} GB free${needed}`;
    return { id: "disk", label, status: enough ? "ok" : "failed", detail };
  } catch {
    return { id: "disk", label, status: "failed", detail: "Could not read the free disk space." };
  }
}

function versionAtLeast(output: string): boolean {
  const match = /(\d+)\.(\d+)/.exec(output);
  if (!match) return false;
  const [major, minor] = [Number(match[1]), Number(match[2])];
  return major > MIN_GIT[0] || (major === MIN_GIT[0] && minor >= MIN_GIT[1]);
}

async function gitStep(env: HostEnv): Promise<CheckStep> {
  const label = "Git";
  const result = await runGit(["--version"], { cwd: homedir(), env }).catch(() => undefined);
  if (result?.exitCode !== 0) {
    return { id: "git", label, status: "failed", detail: "Git is not installed." };
  }
  const detail = result.stdout.trim();
  const current = versionAtLeast(detail);
  const tooOld = `${detail} is too old; version ${MIN_GIT.join(".")} or newer is needed.`;
  return { id: "git", label, status: current ? "ok" : "failed", detail: current ? detail : tooOld };
}

async function identityStep(gitStatus: CheckStep["status"], env: HostEnv): Promise<CheckStep> {
  const label = "Git identity";
  if (gitStatus !== "ok")
    return { id: "gitIdentity", label, status: "skipped", detail: "Git is not available." };
  const options = { cwd: homedir(), env };
  const name = await runGit(["config", "user.name"], options);
  const email = await runGit(["config", "user.email"], options);
  if (name.stdout.trim() !== "" && email.stdout.trim() !== "") {
    return {
      id: "gitIdentity",
      label,
      status: "ok",
      detail: `${name.stdout.trim()} <${email.stdout.trim()}>`,
    };
  }
  const detail = "Set your name and email: git config --global user.name and user.email.";
  return { id: "gitIdentity", label, status: "failed", detail };
}

/** Local checks for the "Add workspace" checklist. */
export async function checkWorkspace(env: HostEnv): Promise<{ steps: CheckStep[] }> {
  const git = await gitStep(env);
  return { steps: [osStep(), await diskStep(env), git, await identityStep(git.status, env)] };
}
