export type OutputHandler = (stream: "stdout" | "stderr", text: string) => void;

async function forward(
  stream: ReadableStream<Uint8Array>,
  name: "stdout" | "stderr",
  onOutput: OutputHandler,
): Promise<void> {
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    onOutput(name, decoder.decode(chunk, { stream: true }));
  }
}

/** Runs the script with `sh -c` in the worktree, streaming output; returns the exit code. */
export async function runSetupScript(options: {
  script: string | undefined;
  cwd: string;
  env: Record<string, string>;
  onOutput: OutputHandler;
}): Promise<number> {
  if (options.script === undefined || options.script.trim() === "") return 0;
  const proc = Bun.spawn(["sh", "-c", options.script], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode] = await Promise.all([
    proc.exited,
    forward(proc.stdout, "stdout", options.onOutput),
    forward(proc.stderr, "stderr", options.onOutput),
  ]);
  return exitCode;
}
