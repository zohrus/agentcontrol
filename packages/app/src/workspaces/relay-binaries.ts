import { join } from "node:path";
import { buildIdentity } from "@agentcontrol/protocol/build-id";
import { z } from "zod";
import { findResources } from "../resources/index.ts";
import type { SshSettings } from "./types.ts";

type Machine = { os: string; arch: string };

/** The part of `dist/manifest.json` that says which code the binaries beside it were built from. */
const Manifest = z.object({ buildId: z.string().optional() });

/** The code the binaries in `directory` were built from, when the build recorded it. */
async function builtFrom(directory: string): Promise<string | undefined> {
  const manifest: unknown = await Bun.file(join(directory, "manifest.json"))
    .json()
    .catch(() => undefined);
  return Manifest.safeParse(manifest).data?.buildId;
}

/** Why the relay a source checkout built is not from the checkout's current code, if it is not. */
async function staleBecause(directory: string, machine: Machine): Promise<string | undefined> {
  const built = await builtFrom(directory);
  const now = buildIdentity();
  if (built === now) return undefined;
  const was = built === undefined ? "before builds recorded their code" : `from build ${built}`;
  return `The relay in ${directory} was built ${was}, but this checkout's relay code is build ${now}. Build it again with: bun scripts/build.ts --only relay-${machine.os}, then retry.`;
}

/**
 * Relay binaries named like the release files (`agentcontrol-relay-linux-x64`) in one folder.
 * In a source checkout (`buildFromSource`) they only exist after a build, so a missing one comes
 * with the command that builds it, and one built from older code than the checkout's is refused
 * with the same command.
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
  binaryFor.staleAdvice = (machine) => staleBecause(directory, machine);
  return binaryFor;
}

/** The relay binaries to install on ssh hosts: the release's `relays/` folder, else a checkout's `dist/`. */
export function shippedRelayBinaries(sourceCheckoutDist: string): SshSettings["relayBinaryFor"] {
  const { relaysDir } = findResources({ env: process.env, execPath: process.execPath });
  if (relaysDir !== undefined) return relayBinariesIn(relaysDir);
  return relayBinariesIn(sourceCheckoutDist, { buildFromSource: true });
}
