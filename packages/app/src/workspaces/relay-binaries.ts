import { join } from "node:path";
import type { SshSettings } from "./types.ts";

/** Relay binaries named like the release files (`agentcontrol-relay-linux-x64`) in one folder. */
export function relayBinariesIn(directory: string): SshSettings["relayBinaryFor"] {
  return ({ os, arch }) => join(directory, `agentcontrol-relay-${os}-${arch}`);
}
