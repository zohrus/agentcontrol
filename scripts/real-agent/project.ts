import { join } from "node:path";

async function runGit(cwd: string, ...args: string[]): Promise<void> {
  const run = Bun.spawn(["git", ...args], { cwd, stdout: "ignore", stderr: "inherit" });
  if ((await run.exited) !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}`);
}

const FILES: Record<string, string> = {
  "greeting.js": 'export const greeting = "Hello, world";\n',
  "README.md": "# Tiny project\n\nOne exported greeting.\n",
};

/** A tiny project committed on top of the repo the e2e helpers made, so the agent has something to edit. */
export async function addTinyProject(repoPath: string): Promise<void> {
  for (const [name, content] of Object.entries(FILES)) {
    await Bun.write(join(repoPath, name), content);
  }
  await runGit(repoPath, "add", ...Object.keys(FILES));
  await runGit(repoPath, "commit", "-m", "Add the tiny project");
}
