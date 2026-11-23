import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { freePort } from "./ssh-network.ts";

const SSHD = "/usr/sbin/sshd";
const START_TIMEOUT_MS = 10_000;
const POLL_MS = 30;

/** A private ssh server running as the current user, on a free port of 127.0.0.1. */
export interface Sshd {
  readonly port: number;
  /** The `Host` block that reaches this server through `viaPort` with the generated keys. */
  hostBlock(options: { alias: string; viaPort: number }): string;
  stop(): Promise<void>;
}

/** The name sshd will accept the key for: the user running the tests. */
function currentUser(): string {
  return Bun.spawnSync(["id", "-un"]).stdout.toString().trim();
}

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "ignore", stderr: "pipe" });
  const [stderr, exitCode] = await Promise.all([new Response(child.stderr).text(), child.exited]);
  if (exitCode !== 0) throw new Error(`\`${command.join(" ")}\` failed: ${stderr}`);
}

async function writeKeys(folder: string): Promise<{ hostKey: string; clientKey: string }> {
  const hostKey = join(folder, "host_key");
  const clientKey = join(folder, "client_key");
  await run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", hostKey]);
  await run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", clientKey]);
  await Bun.write(join(folder, "authorized_keys"), await Bun.file(`${clientKey}.pub`).text());
  return { hostKey, clientKey };
}

function configOf(options: {
  folder: string;
  hostKey: string;
  port: number;
  home: string;
}): string {
  const { folder, hostKey, port, home } = options;
  return [
    `Port ${String(port)}`,
    "ListenAddress 127.0.0.1",
    `HostKey ${hostKey}`,
    `PidFile ${join(folder, "sshd.pid")}`,
    `AuthorizedKeysFile ${join(folder, "authorized_keys")}`,
    "PasswordAuthentication no",
    "KbdInteractiveAuthentication no",
    "UsePAM no",
    "StrictModes no",
    "LogLevel ERROR",
    `SetEnv HOME=${home}`,
  ].join("\n");
}

async function waitUntilAccepting(port: number, exited: Promise<unknown>): Promise<void> {
  const state = { ended: false };
  void exited.then(() => {
    state.ended = true;
  });
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (!state.ended && Date.now() < deadline) {
    const reached = await Bun.connect({
      hostname: "127.0.0.1",
      port,
      socket: {
        data: () => undefined,
        open: (socket) => {
          socket.end();
        },
      },
    }).then(
      () => true,
      () => false,
    );
    if (reached) return;
    await Bun.sleep(POLL_MS);
  }
  throw new Error("the private sshd did not start accepting connections");
}

/** The `Host` block of an ssh config that reaches the server through `viaPort` with the client key. */
function hostBlockOf(options: {
  alias: string;
  viaPort: number;
  folder: string;
  clientKey: string;
}): string {
  const { alias, viaPort, folder, clientKey } = options;
  return [
    `Host ${alias}`,
    "  HostName 127.0.0.1",
    `  Port ${String(viaPort)}`,
    `  User ${currentUser()}`,
    `  IdentityFile ${clientKey}`,
    "  IdentitiesOnly yes",
    `  UserKnownHostsFile ${join(folder, "known_hosts")}`,
    "  StrictHostKeyChecking no",
    "  LogLevel ERROR",
  ].join("\n");
}

/**
 * Starts a throwaway sshd as the current user: its own host key, one client key, no passwords.
 * Its sessions see `home` as `$HOME`, so nothing of the real home folder is used.
 * Needs the OpenSSH server installed and the privilege separation folder /run/sshd to exist.
 */
export async function startSshd(options: { folder: string; home: string }): Promise<Sshd> {
  const { folder, home } = options;
  if (!existsSync(SSHD)) throw new Error(`The OpenSSH server is missing: install it (${SSHD}).`);
  await mkdir("/run/sshd", { recursive: true });
  const { hostKey, clientKey } = await writeKeys(folder);
  const port = freePort();
  const configFile = join(folder, "sshd_config");
  await Bun.write(configFile, configOf({ folder, hostKey, port, home }));
  const child = Bun.spawn([SSHD, "-D", "-e", "-f", configFile], {
    stdout: "ignore",
    stderr: "ignore",
  });
  await waitUntilAccepting(port, child.exited);
  return {
    port,
    hostBlock: (options) => hostBlockOf({ ...options, folder, clientKey }),
    stop: async () => {
      child.kill();
      await child.exited;
    },
  };
}
