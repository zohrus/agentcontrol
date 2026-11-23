import { mkdir, utimes } from "node:fs/promises";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";
import { git } from "./git.ts";
import { type FakeRegistry, startFakeRegistry } from "./fake-registry.ts";
import { mockAdapterPackage } from "./mock-adapter-package.ts";
import type { Session } from "./relay.ts";
import { type RunningRelay, startRelayWithLocalRepo } from "./start-relay.ts";

/** The repo carries a bunfig.toml that preloads a script, and a .env file: files Bun reads on start. */
export async function repoHoldsItsOwnBunConfigAndEnvFile(relay: RunningRelay): Promise<void> {
  await Bun.write(join(relay.repoPath, "bunfig.toml"), 'preload = ["./preload.ts"]\n');
  await Bun.write(join(relay.repoPath, "preload.ts"), 'await Bun.write("preloaded", "yes");\n');
  await Bun.write(join(relay.repoPath, ".env"), "LEAKED=1\n");
  await git(relay.repoPath, "add", ".");
  await git(
    relay.repoPath,
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@example.com",
    "commit",
    "-m",
    "Bun files",
  );
}

/** An earlier relay was killed in the middle of an install two hours ago and left its work folder. */
export async function aKilledRelayLeftAHalfMadeInstall(relay: RunningRelay): Promise<void> {
  const leftover = join(relay.dataDir, "adapters", ".installing-killed");
  await mkdir(leftover, { recursive: true });
  await Bun.write(join(leftover, "package.json"), "{}");
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await utimes(leftover, twoHoursAgo, twoHoursAgo);
}

/** A relay whose Claude Code adapter is downloaded from a registry on this machine. */
export interface RelayWithAdapterRegistry extends RunningRelay {
  readonly registry: FakeRegistry;
  /** Starts a Claude Code session, run by the downloaded adapter (the scripted mock agent). */
  startsClaudeCodeSession(options: { prompt: string }): Promise<Session>;
}

/**
 * A relay with no Claude Code adapter yet. The registry it installs from serves the pinned
 * version, whose program is the mock agent (or `adapterSource`), and takes `slowMs` to hand out
 * the package.
 */
export async function startRelayWithAdapterRegistry(
  options: { slowMs?: number; env?: Record<string, string>; adapterSource?: string } = {},
): Promise<RelayWithAdapterRegistry> {
  const registry = await startFakeRegistry({
    pkg: mockAdapterPackage(options.adapterSource),
    ...(options.slowMs === undefined ? {} : { slowMs: options.slowMs }),
  });
  onTestEnd(() => {
    registry.stop();
    return Promise.resolve();
  });
  const env = { ...options.env, NPM_CONFIG_REGISTRY: registry.url };
  const relay = await startRelayWithLocalRepo({ env });
  return Object.assign(relay, {
    registry,
    startsClaudeCodeSession: (call: { prompt: string }) =>
      relay.user.startsSession({ ...call, agent: "claude-code" }),
  });
}
