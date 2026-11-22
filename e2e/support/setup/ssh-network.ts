import type { Socket } from "bun";

/** One proxied connection: the app's side, the host's side once open, and bytes waiting for it. */
interface Pair {
  client: Socket<Pair> | undefined;
  server: Socket<Pair> | undefined;
  waiting: Uint8Array[];
}

/** The network between the app and the ssh host, which a test can cut or take down. */
export interface SshNetwork {
  /** The port the app's ssh connects to (the proxy's); the host's own port is behind it. */
  readonly port: number;
  /** Cuts every open connection at once, as a dropped Wi-Fi does. New ones are accepted. */
  drops(): void;
  /** Cuts every open connection and refuses new ones, as an unplugged cable does. */
  goesDown(): void;
  /** Accepts connections again. */
  comesBack(): void;
  stop(): void;
}

/** A free TCP port on 127.0.0.1. */
export function freePort(): number {
  const listener = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: { data: () => undefined },
  });
  const { port } = listener;
  listener.stop(true);
  return port;
}

const endBoth = (pair: Pair): void => {
  pair.client?.end();
  pair.server?.end();
};

/** Forwards bytes from one side of a pair to the other, holding them until the other side is open. */
function forward(pair: Pair, from: "client" | "server", data: Uint8Array): void {
  const to = from === "client" ? pair.server : pair.client;
  if (to) to.write(data);
  else pair.waiting.push(data);
}

function hostSide(options: { hostPort: number; pair: Pair }): void {
  const { hostPort, pair } = options;
  void Bun.connect<Pair>({
    hostname: "127.0.0.1",
    port: hostPort,
    data: pair,
    socket: {
      open: (server) => {
        pair.server = server;
        pair.waiting.splice(0).forEach((bytes) => server.write(bytes));
      },
      data: (_, bytes) => {
        forward(pair, "server", bytes);
      },
      close: () => {
        endBoth(pair);
      },
      error: () => {
        endBoth(pair);
      },
    },
  });
}

/** Starts listening on `port`, passing every connection on to the host's port. */
function listenAndPassOn(options: { port: number; hostPort: number; pairs: Set<Pair> }) {
  const { port, hostPort, pairs } = options;
  return Bun.listen<Pair>({
    hostname: "127.0.0.1",
    port,
    socket: {
      open: (client) => {
        const pair: Pair = { client, server: undefined, waiting: [] };
        client.data = pair;
        pairs.add(pair);
        hostSide({ hostPort, pair });
      },
      data: (client, bytes) => {
        forward(client.data, "client", bytes);
      },
      close: (client) => {
        endBoth(client.data);
        pairs.delete(client.data);
      },
      error: () => undefined,
    },
  });
}

/** A proxy in front of the ssh host's port, so a test can make the network fail on purpose. */
export function startSshNetwork(hostPort: number): SshNetwork {
  const port = freePort();
  const pairs = new Set<Pair>();
  const listen = () => listenAndPassOn({ port, hostPort, pairs });
  let listener: ReturnType<typeof listen> | undefined = listen();
  const cut = (): void => {
    pairs.forEach(endBoth);
    pairs.clear();
  };
  const stop = (): void => {
    listener?.stop(true);
    listener = undefined;
    cut();
  };
  return {
    port,
    drops: cut,
    goesDown: stop,
    comesBack: () => {
      listener ??= listen();
    },
    stop,
  };
}
