import { join } from "node:path";
import { findResources } from "../resources/index.ts";
import type { SshSettings } from "./types.ts";

/**
 * Relay binaries named like the release files (`agentcontrol-relay-linux-x64`) in one folder.
 * In a source checkout (`buildFromSource`) they only exist after a build, so a missing one comes
 * with the command that builds it.
 */
export function relayBinariesIn(
  directory: string,
  options: { buildFromSource?: boolean } = {},
): SshSettings["relayBinaryFor"] {
  const binaryFor: SshSettings["relayBinaryFor"] = ({ os, arch }) =>
    join(directory, `agentcontrol-relay-${os}-${arch}`);
  if (options.buildFromSource !== true) return binaryFor;
  binaryFor.missingAdvice = ({ os }) =>
    `Build it once with: bun scripts/build.ts --only relay-${os}, then retry.`;
  return binaryFor;
}

/** The relay binaries to install on ssh hosts: the release's `relays/` folder, else a checkout's `dist/`. */
export function shippedRelayBinaries(sourceCheckoutDist: string): SshSettings["relayBinaryFor"] {
  const { relaysDir } = findResources({ env: process.env, execPath: process.execPath });
  if (relaysDir !== undefined) return relayBinariesIn(relaysDir);
  return relayBinariesIn(sourceCheckoutDist, { buildFromSource: true });
}
