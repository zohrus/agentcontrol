import type { HostInfo } from "@agentcontrol/app";
import { eventually } from "../setup/eventually.ts";
import { relayIsRunning } from "../setup/local-target.ts";

/** The relay answered with the agents it can run. */
export function expectRelayToBeRunning(agents: string[]): void {
  if (agents.length === 0)
    throw new Error("expected the relay to answer with its agents, but it listed none");
}

/** The relay daemon of this data folder is running. */
export async function expectRelayToStillBeRunning(dataDir: string): Promise<void> {
  if (!(await relayIsRunning(dataDir)))
    throw new Error("expected the relay to keep running, but it is gone");
}

/** The relay daemon of this data folder ends, eventually. */
export async function expectRelayToHaveStopped(dataDir: string): Promise<void> {
  await eventually("expected the relay to have stopped", async () =>
    (await relayIsRunning(dataDir)) ? "it is still running" : undefined,
  );
}

/** The description names this machine's system and CPU, and how much disk is free. */
export function expectDescriptionOfThisMachine(machine: HostInfo): void {
  const named = machine.os === process.platform && machine.arch.length > 0;
  if (!named || machine.freeDiskGb === undefined || machine.freeDiskGb <= 0) {
    throw new Error(`expected a description of this machine, but got ${JSON.stringify(machine)}`);
  }
}

/** Nothing was installed, the relay counts as in place, and the port is the one asked for. */
export function expectNothingToInstallOrForward(outcome: {
  installed: { installed: boolean };
  present: boolean;
  localPort: number;
  explained: string | undefined;
}): void {
  const fine =
    !outcome.installed.installed &&
    outcome.present &&
    outcome.localPort === 4321 &&
    outcome.explained === undefined;
  if (!fine)
    throw new Error(`expected nothing to install or forward, but got ${JSON.stringify(outcome)}`);
}
