/** Runs git in a folder and returns what it printed; a failure says which command failed. */
export async function git(cwd: string, ...args: string[]): Promise<string> {
  const run = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "inherit" });
  const [output, exitCode] = await Promise.all([run.stdout.text(), run.exited]);
  if (exitCode !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}`);
  return output;
}
