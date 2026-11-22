import { statfs } from "node:fs/promises";
import { homedir } from "node:os";
import type { CheckStep as CheckStepSchema } from "@agentcontrol/protocol";
import type { z } from "zod";
import { runGit } from "../git/index.ts";

type CheckStep = z.infer<typeof CheckStepSchema>;

const MIN_FREE_GB = 5;
const MIN_GIT: [number, number] = [2, 25];

function osStep(): CheckStep {
  const detail = `${process.platform} ${process.arch}`;
  return { id: "os", label: "Operating system", status: "ok", detail };
}

async function diskStep(): Promise<CheckStep> {
  const label = "Free disk space";
  try {
    const stats = await statfs(homedir());
    const freeGb = (stats.bavail * stats.bsize) / 1024 ** 3;
    const detail = `${freeGb.toFixed(1)} GB free`;
    if (freeGb >= MIN_FREE_GB) return { id: "disk", label, status: "ok", detail };
    return {
      id: "disk",
      label,
      status: "failed",
      detail: `${detail}; at least ${String(MIN_FREE_GB)} GB is needed.`,
    };
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

async function gitStep(): Promise<CheckStep> {
  const label = "Git";
  const result = await runGit(["--version"], { cwd: homedir() }).catch(() => undefined);
  if (result?.exitCode !== 0) {
    return { id: "git", label, status: "failed", detail: "Git is not installed." };
  }
  const detail = result.stdout.trim();
  if (versionAtLeast(detail)) return { id: "git", label, status: "ok", detail };
  return {
    id: "git",
    label,
    status: "failed",
    detail: `${detail} is too old; version ${MIN_GIT.join(".")} or newer is needed.`,
  };
}

async function identityStep(gitStatus: CheckStep["status"]): Promise<CheckStep> {
  const label = "Git identity";
  if (gitStatus !== "ok")
    return { id: "gitIdentity", label, status: "skipped", detail: "Git is not available." };
  const cwd = homedir();
  const name = await runGit(["config", "user.name"], { cwd });
  const email = await runGit(["config", "user.email"], { cwd });
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
export async function checkWorkspace(): Promise<{ steps: CheckStep[] }> {
  const git = await gitStep();
  return { steps: [osStep(), await diskStep(), git, await identityStep(git.status)] };
}
