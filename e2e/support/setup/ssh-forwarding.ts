import { type ForwardedPort, sshTarget } from "@agentcontrol/app";
import { onTestEnd } from "./cleanup.ts";
import type { SshHost } from "./ssh-host.ts";

const GREETING = "hello from the dev server on the host";

/** A program on the host that listens on a port and greets whoever connects, like a dev server. */
export function startDevServerOnHost(): { port: number; greeting: string } {
  const server = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: {
      open: (socket) => {
        socket.end(GREETING);
      },
      data: () => undefined,
    },
  });
  onTestEnd(() => {
    server.stop(true);
    return Promise.resolve();
  });
  return { port: server.port, greeting: GREETING };
}

/** Makes a port of the host reachable on this machine, the way the browser IDE and previews will. */
export async function forwardsPortOfHost(
  host: SshHost,
  remotePort: number,
): Promise<ForwardedPort> {
  const target = sshTarget({
    host: host.alias,
    configFile: host.configFile,
    version: "0.0.0",
    root: host.remoteRoot,
  });
  const forwarded = await target.forwardPort(remotePort);
  onTestEnd(() => forwarded.close());
  return forwarded;
}

/** What the program listening on this machine's port says when connected to. */
export async function connectsAndReadsGreeting(port: number): Promise<string> {
  const heard = Promise.withResolvers<string>();
  let text = "";
  await Bun.connect({
    hostname: "127.0.0.1",
    port,
    socket: {
      data: (_, bytes) => {
        text += new TextDecoder().decode(bytes);
      },
      close: () => {
        heard.resolve(text);
      },
    },
  });
  return heard.promise;
}
