import { explainSsh, SshFailure } from "./ssh-failure.ts";

/** How to reach one host with the system `ssh`, so ~/.ssh/config, keys, agents and jump hosts work. */
export interface SshDestination {
  host: string;
  /** A config file for `ssh -F`; the usual ~/.ssh/config when left out. */
  configFile?: string | undefined;
}

/**
 * The ssh command line up to the host: never prompts (BatchMode), notices a dead connection within
 * about 15 seconds (ServerAlive) and gives up connecting after 10.
 */
export function sshArgv(destination: SshDestination): string[] {
  const { host, configFile } = destination;
  const options = [
    "BatchMode=yes",
    "ServerAliveInterval=5",
    "ServerAliveCountMax=3",
    "ConnectTimeout=10",
  ];
  return [
    "ssh",
    ...(configFile === undefined ? [] : ["-F", configFile]),
    ...options.flatMap((option) => ["-o", option]),
    "-T",
    host,
  ];
}

export interface SshResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Runs one remote command (a shell script as text) and collects its output. */
export async function runSsh(options: {
  destination: SshDestination;
  script: string;
  /** Sent to the command's stdin, for example a file to store. */
  input?: Blob;
}): Promise<SshResult> {
  const { destination, script, input } = options;
  const child = Bun.spawn([...sshArgv(destination), script], {
    stdin: input ?? "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, exitCode };
}

/** Like `runSsh`, but a non-zero exit becomes a failure with the plain-language reason. */
export async function runSshOrFail(options: Parameters<typeof runSsh>[0]): Promise<string> {
  const result = await runSsh(options);
  if (result.exitCode === 0) return result.stdout;
  const reason = explainSsh({ stderr: result.stderr, host: options.destination.host });
  throw new SshFailure(reason ?? `ssh exited with code ${String(result.exitCode)}.`);
}
