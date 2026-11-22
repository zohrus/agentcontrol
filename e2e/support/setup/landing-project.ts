import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";

const repoRoot = join(import.meta.dir, "../../..");

/** A tiny project with an `origin` to land into: what `bun run integrate` works on. */
export interface Project {
  /** The clone the person works in. */
  readonly work: string;
  /** The remote `main` lives on. */
  readonly origin: string;
}

/** What a script printed, and how it ended. */
export interface Ran {
  readonly exitCode: number;
  readonly output: string;
}

/** Runs a command in a folder; never throws, so a failing git command can be part of a story. */
async function run(cwd: string, command: string[], env: Record<string, string> = {}): Promise<Ran> {
  const child = Bun.spawn(command, {
    cwd,
    env: { ...Bun.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, exitCode] = await Promise.all([
    child.stdout.text(),
    child.stderr.text(),
    child.exited,
  ]);
  return { exitCode, output: out + err };
}

export async function gitIn(project: Project, ...args: string[]): Promise<Ran> {
  return run(project.work, ["git", ...args]);
}

/** A project whose `main` has one commit and whose origin has it too; no hooks, no dependencies. */
export async function createProjectWithOrigin(): Promise<Project> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "agentcontrol-landing-")));
  onTestEnd(() => rm(root, { recursive: true, force: true }));
  const project: Project = { work: join(root, "work"), origin: join(root, "origin.git") };
  await run(root, ["git", "init", "--bare", "--initial-branch=main", project.origin]);
  await run(root, ["git", "clone", project.origin, project.work]);
  await gitIn(project, "config", "user.name", "Test User");
  await gitIn(project, "config", "user.email", "test@example.com");
  await Bun.write(
    join(project.work, "package.json"),
    '{"name":"demo","private":true,"scripts":{"check":"true"}}\n',
  );
  await Bun.write(join(project.work, "docs/landings.log"), "");
  await commitAll(project, "Start the project");
  await gitIn(project, "push", "origin", "main");
  return project;
}

async function commitAll(project: Project, message: string): Promise<void> {
  await gitIn(project, "add", "-A");
  await gitIn(project, "commit", "-m", message);
}

/** Commits a file with this text on the branch (made from main if it does not exist yet). */
export async function commitsFile(
  project: Project,
  change: { branch: string; file: string; text: string },
): Promise<void> {
  const { branch, file, text } = change;
  const exists = (await gitIn(project, "rev-parse", "--verify", branch)).exitCode === 0;
  await gitIn(project, ...(exists ? ["checkout", branch] : ["checkout", "-b", branch, "main"]));
  await Bun.write(join(project.work, file), text);
  await commitAll(project, `Change ${file} on ${branch}`);
}

/** Pushes main as it is, so origin/main moves. */
export async function publishesMain(project: Project): Promise<void> {
  await gitIn(project, "push", "origin", "main");
}

/** Merges origin/main into the branch, then settles any conflict by keeping both sides' text. */
export async function mergesMainIntoTheBranch(project: Project, branch: string): Promise<void> {
  await gitIn(project, "checkout", branch);
  await gitIn(project, "fetch", "origin", "main");
  const merge = await gitIn(project, "merge", "origin/main", "--no-edit");
  if (merge.exitCode === 0) return;
  const conflicted = (await gitIn(project, "diff", "--name-only", "--diff-filter=U")).output.trim();
  await Bun.write(join(project.work, conflicted), "main and feature together\n");
  await gitIn(project, "add", conflicted);
  await gitIn(project, "commit", "--no-edit");
}

const withDependency =
  '{"name":"demo","private":true,"scripts":{"check":"true"},"dependencies":{"left-pad":"1.0.0"}}\n';

/** Main gains a dependency, as the orchestrator adds one for everybody. */
export async function mainGainsADependency(project: Project): Promise<void> {
  await gitIn(project, "checkout", "main");
  await Bun.write(join(project.work, "package.json"), withDependency);
  await commitAll(project, "Add left-pad");
  await publishesMain(project);
}

/** Starts merging origin/main into the branch and leaves the merge uncommitted, as a person does to settle conflicts. */
export async function startsMergingMainIntoTheBranch(
  project: Project,
  branch: string,
): Promise<void> {
  await gitIn(project, "checkout", branch);
  await gitIn(project, "fetch", "origin", "main");
  await gitIn(project, "merge", "origin/main", "--no-commit", "--no-ff");
}

/** The branch adds a dependency itself and stages it. */
export async function stagesADependencyOnTheBranch(
  project: Project,
  branch: string,
): Promise<void> {
  await gitIn(project, "checkout", branch);
  await Bun.write(join(project.work, "package.json"), withDependency);
  await gitIn(project, "add", "package.json");
}

/** Runs `bun run integrate <branch>` from the project, as an agent's orchestrator would. */
export function integrates(project: Project, branch: string, flags: string[] = []): Promise<Ran> {
  return run(project.work, ["bun", join(repoRoot, "scripts/integrate.ts"), branch, ...flags]);
}

/** Runs the pre-commit dependency guard on what is staged right now. */
export function runsTheDependencyGuard(project: Project): Promise<Ran> {
  return run(project.work, ["bun", join(repoRoot, "scripts/guard-deps.ts")]);
}

/** Whether origin's main has this file. */
export async function originMainHas(project: Project, file: string): Promise<boolean> {
  return (await run(project.origin, ["git", "cat-file", "-e", `main:${file}`])).exitCode === 0;
}

/** The text of a file on origin's main. */
export async function originMainFile(project: Project, file: string): Promise<string> {
  return (await run(project.origin, ["git", "show", `main:${file}`])).output;
}
