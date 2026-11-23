import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RelayName as N } from "@agentcontrol/protocol";
import { onTestEnd } from "./cleanup.ts";
import type { Session } from "./relay.ts";
import { SHELL_RELAY_ENV } from "./start-app-with-shell.ts";
import { startRelayWithLocalRepo } from "./start-relay.ts";

/** A user's login shell that is recognisable among processes: it does nothing but sleep. */
export interface SleepingShell {
  /** The text that identifies its process. */
  marker: string;
}

/** Where the relay stands while it is held just before starting a shell. */
export interface HeldRelay {
  relay: Awaited<ReturnType<typeof startRelayWithLocalRepo>>;
  shell: SleepingShell;
  /** Lets the held request go on. */
  release(): void;
}

async function aShellThatOnlySleeps(): Promise<{ program: string }> {
  const folder = await mkdtemp(join(tmpdir(), "agentcontrol-sleeping-shell-"));
  onTestEnd(() => rm(folder, { recursive: true, force: true }));
  const program = join(folder, "shell.sh");
  await writeFile(program, "#!/bin/sh\nsleep 1000\n");
  await chmod(program, 0o755);
  return { program };
}

/**
 * A relay whose user's shell is a program that only sleeps, and which holds every request for a
 * terminal just before the shell would start, until `release` is called.
 */
export async function aRelayThatHoldsTerminalsBeforeTheirShellStarts(): Promise<HeldRelay> {
  const { program } = await aShellThatOnlySleeps();
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const relay = await startRelayWithLocalRepo({
    env: { ...SHELL_RELAY_ENV, SHELL: program },
    beforeShellStarts: () => released,
  });
  return {
    relay,
    shell: { marker: program },
    release: () => {
      release();
    },
  };
}

/** Connects straight to the relay, asks for a terminal on the session and hangs up. */
export async function asksForATerminalAndHangsUp(held: HeldRelay, session: Session): Promise<void> {
  const socket = connect(join(held.relay.dataDir, "relay.sock"));
  socket.on("error", () => undefined);
  const params = { sessionId: session.id, cols: 80, rows: 24 };
  const request = { jsonrpc: "2.0", id: 1, method: N.terminalOpen, params };
  await new Promise<void>((resolve) => {
    socket.once("connect", resolve);
  });
  socket.write(`${JSON.stringify(request)}\n`);
  await new Promise<void>((resolve) => {
    socket.end(resolve);
  });
  socket.destroy();
}

/** How many running processes are this program's shells. */
export function shellsRunning(shell: SleepingShell): number {
  const listing = Bun.spawnSync(["ps", "-A", "-o", "command="]).stdout.toString();
  return listing.split("\n").filter((line) => line.includes(shell.marker)).length;
}

/** A round trip on another connection: what the relay was told before it has been dealt with. */
export async function waitsForTheRelayToCatchUp(held: HeldRelay): Promise<void> {
  const other = held.relay.connectsAnotherClient();
  onTestEnd(() => other.disconnect());
  await other.call(N.hello, { clientVersion: "test" });
}
