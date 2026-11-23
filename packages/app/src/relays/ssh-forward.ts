import { createServer } from "node:net";
import { type SshDestination, sshArgv } from "./ssh-run.ts";
import { SshFailure } from "./ssh-failure.ts";
import type { ForwardedPort } from "./target.ts";

const READY_TIMEOUT_MS = 15_000;
const POLL_MS = 50;

function freeLocalPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

/** Whether something accepts connections on 127.0.0.1:port; a refused connection is just "no". */
async function accepts(port: number): Promise<boolean> {
  const open = Bun.connect({
    hostname: "127.0.0.1",
    port,
    socket: {
      data: () => undefined,
      open: (socket) => {
        socket.end();
      },
    },
  });
  return open.then(
    () => true,
    () => false,
  );
}

async function waitUntilListening(port: number, ended: Promise<unknown>): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  const ssh = { stopped: false };
  void ended.then(() => {
    ssh.stopped = true;
  });
  while (!ssh.stopped && Date.now() < deadline) {
    if (await accepts(port)) return;
    await Bun.sleep(POLL_MS);
  }
  throw new SshFailure("The port could not be forwarded over ssh.");
}

/** `ssh -N -L`: a free port on 127.0.0.1 here that leads to `remotePort` on the host. */
export async function forwardOverSsh(options: {
  destination: SshDestination;
  remotePort: number;
}): Promise<ForwardedPort> {
  const localPort = await freeLocalPort();
  const spec = `127.0.0.1:${String(localPort)}:127.0.0.1:${String(options.remotePort)}`;
  const [ssh, ...rest] = sshArgv(options.destination);
  const argv = [ssh ?? "ssh", "-N", "-o", "ExitOnForwardFailure=yes", "-L", spec, ...rest];
  const child = Bun.spawn(argv, { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
  const close = async (): Promise<void> => {
    child.kill();
    await child.exited;
  };
  await waitUntilListening(localPort, child.exited).catch(async (error: unknown) => {
    await close();
    throw error;
  });
  return { localPort, close };
}
