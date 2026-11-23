import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { relayClientOver, startApp } from "@agentcontrol/app";
import { onTestEnd } from "./cleanup.ts";
import { startRelayHost } from "./relay-host.ts";

/** What happened when a second app was started on the port a running app already uses. */
export async function startsSecondAppOnTheSamePort(baseUrl: string): Promise<string> {
  const dataDir = await mkdtemp(join(tmpdir(), "agentcontrol-second-"));
  onTestEnd(() => rm(dataDir, { recursive: true, force: true }));
  const host = await startRelayHost({ dataDir: join(dataDir, "relay"), env: {} });
  onTestEnd(() => host.stop());
  try {
    const app = await startApp({
      dataDir,
      port: Number(new URL(baseUrl).port),
      connectRelay: () => relayClientOver(host.wire()),
    });
    await app.stop();
    return "the second app started on the port the first one was using, but it should have been refused";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
