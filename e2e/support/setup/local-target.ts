import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localTarget, relayClientOver, spawnBridge, type WorkspaceTarget } from "@agentcontrol/app";
import { RelayName } from "@agentcontrol/protocol";
import { onTestEnd } from "./cleanup.ts";

const relayMain = join(import.meta.dir, "../../../packages/relay/src/main.ts");

/** The target for this machine, with a relay data folder of its own; its relay stops when the test ends. */
export async function startsLocalTarget(): Promise<{ target: WorkspaceTarget; dataDir: string }> {
  const dataDir = await mkdtemp(join(tmpdir(), "agentcontrol-target-"));
  const target = localTarget({ command: ["bun", relayMain], dataDir });
  onTestEnd(async () => {
    await target.stopRelay();
    await rm(dataDir, { recursive: true, force: true });
  });
  return { target, dataDir };
}

/** Runs the relay bridge the target describes and asks the relay who it is, as the app does. */
export async function asksTheRelayStartedByTheTarget(target: WorkspaceTarget): Promise<string[]> {
  const client = relayClientOver(spawnBridge({ argv: target.bridgeCommand() }));
  const { agents } = await client.call(RelayName.hello, { clientVersion: "0.0.0" });
  await client.close();
  return agents;
}

/** Whether a relay daemon of this data folder is running now. */
export async function relayIsRunning(dataDir: string): Promise<boolean> {
  const text = await Bun.file(join(dataDir, "relay.pid"))
    .text()
    .catch(() => "");
  const pid = Number(text);
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Asks the target to install the relay, whether it is in place, and to forward port 4321. */
export async function asksForInstallAndForward(target: WorkspaceTarget) {
  const installed = await target.install("/unused");
  const present = await target.isInstalled();
  const forwarded = await target.forwardPort(4321);
  return {
    installed,
    present,
    localPort: forwarded.localPort,
    explained: target.explainFailure("anything"),
  };
}
