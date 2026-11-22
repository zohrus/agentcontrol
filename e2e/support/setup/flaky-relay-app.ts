import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@agentcontrol/sdk";
import { launchAppProcess } from "./app-process.ts";
import { onTestEnd } from "./cleanup.ts";
import { stopDaemonProcess } from "./relay-host.ts";

const flakyRelay = join(import.meta.dir, "flaky-relay.ts");
const relayMain = join(import.meta.dir, "../../../packages/relay/src/main.ts");

/** The app as its own process, whose relay command fails until `theRelayCommandWorks()`. */
export async function startAppWhoseRelayCommandFailsAtFirst() {
  const dataDir = await mkdtemp(join(tmpdir(), "agentcontrol-flaky-"));
  const marker = join(dataDir, "relay-command-works");
  onTestEnd(() => rm(dataDir, { recursive: true, force: true }));
  const command = ["bun", flakyRelay, marker, relayMain];
  const app = await launchAppProcess({
    dataDir,
    env: { AGENTCONTROL_RELAY_CMD: JSON.stringify(command) },
  });
  // Teardowns run last-in first-out: quit the app first, so it cannot start a daemon after it was stopped.
  onTestEnd(() => stopDaemonProcess(join(dataDir, "relay")));
  onTestEnd(() => app.stop());
  return {
    sdk: createClient({ baseUrl: app.baseUrl }),
    baseUrl: app.baseUrl,
    theRelayCommandWorks: async (): Promise<void> => {
      await Bun.write(marker, "");
    },
  };
}
