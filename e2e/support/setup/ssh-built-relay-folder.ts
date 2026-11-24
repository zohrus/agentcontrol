import { chmod, mkdir } from "node:fs/promises";
import { arch, platform } from "node:os";
import { join } from "node:path";
import { relayBinariesIn, type SshSettings } from "@agentcontrol/app";
import { VERSION } from "@agentcontrol/protocol";
import { buildIdentity } from "@agentcontrol/protocol/build-id";
import type { BuiltFrom, SshHostOptions } from "./ssh-host-options.ts";

/**
 * A `dist/` folder as `bun scripts/build.ts` leaves it in a source checkout: the relay for this
 * machine's system and CPU (the host in tests is this machine), and the manifest that records the
 * code it was built from. Returns the folder.
 */
export async function writeBuiltRelayFolder(options: {
  folder: string;
  relay: string;
  builtFrom: BuiltFrom;
}): Promise<string> {
  const dist = join(options.folder, "dist");
  await mkdir(dist, { recursive: true });
  const binary = join(dist, `agentcontrol-relay-${platform()}-${arch()}`);
  await Bun.write(binary, Bun.file(options.relay));
  await chmod(binary, 0o755);
  const buildId = options.builtFrom === "this-checkout" ? buildIdentity() : "0123456789ab";
  await Bun.write(join(dist, "manifest.json"), JSON.stringify({ version: VERSION, buildId }));
  return dist;
}

/** The file the app installs on the host: a missing one, a given (compiled) binary, or the script. */
function installedFrom(options: SshHostOptions, script: string): string {
  if (options.relayBinaryMissing) return "/nonexistent/agentcontrol-relay";
  return options.relayBinary ?? script;
}

/** What the app uses to find the relay binary: a folder of a source checkout that holds none, or a file. */
export function relayBinaryOf(
  options: SshHostOptions,
  where: { script: string; dist: string | undefined },
): SshSettings["relayBinaryFor"] {
  const { script, dist } = where;
  if (options.relayBinaryNotBuilt) {
    return relayBinariesIn("/nonexistent/dist", { buildFromSource: true });
  }
  if (dist !== undefined) return relayBinariesIn(dist, { buildFromSource: true });
  return () => installedFrom(options, script);
}

/** Edits the source after the relay in `dist/` was built: its manifest now names an older build. */
export async function leaveDistBuiltFromOlderCode(host: {
  dist: string | undefined;
}): Promise<void> {
  await Bun.write(
    join(host.dist ?? "", "manifest.json"),
    JSON.stringify({ version: VERSION, buildId: "0123456789ab" }),
  );
}
