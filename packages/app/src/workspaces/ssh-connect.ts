import { RelayName } from "@agentcontrol/protocol";
import {
  type HostInfo,
  type RelayClient,
  relayClientOver,
  spawnBridge,
  type WorkspaceTarget,
} from "../relays/index.ts";
import type { ReplaceRelay } from "../sync/index.ts";
import type { SshSettings } from "./types.ts";

/**
 * Puts the relay binary that suits the machine in place. Rejects with a plain reason when no binary
 * was built for its OS and CPU.
 */
export async function installOn(options: {
  target: WorkspaceTarget;
  machine: HostInfo;
  relayBinaryFor: SshSettings["relayBinaryFor"];
  ignoreStale?: boolean;
}): Promise<{ installed: boolean }> {
  const { target, machine, relayBinaryFor } = options;
  const binary = relayBinaryFor(machine);
  const unusable = await unusableBecause({
    binary,
    machine,
    relayBinaryFor,
    ignoreStale: options.ignoreStale === true,
  });
  if (unusable !== undefined) throw new Error(unusable);
  return target.install(binary);
}

/** Why a relay binary that is there is built from older code, unless this connection lets that pass. */
function staleBecause(options: {
  machine: HostInfo;
  relayBinaryFor: SshSettings["relayBinaryFor"];
  ignoreStale: boolean;
}): Promise<string | undefined> | undefined {
  return options.ignoreStale ? undefined : options.relayBinaryFor.staleAdvice?.(options.machine);
}

/** Why the relay binary for the machine cannot be used (it is missing, or built from older code), if so. */
async function unusableBecause(options: {
  binary: string;
  machine: HostInfo;
  relayBinaryFor: SshSettings["relayBinaryFor"];
  ignoreStale: boolean;
}): Promise<string | undefined> {
  const { binary, machine, relayBinaryFor } = options;
  if (await Bun.file(binary).exists()) return staleBecause(options);
  const advice = relayBinaryFor.missingAdvice?.(machine);
  const looked = `This app has no relay for ${machine.os} ${machine.arch} (looked for ${binary}).`;
  return advice === undefined ? looked : `${looked} ${advice}`;
}

/**
 * Opens connections to a host's relay. The relay binary is checked on every connection and put in
 * place again when the one there is not this app's: the installed file is not trusted for being
 * there, because an earlier build of the same version left one just the same.
 */
export function sshConnector(options: {
  target: WorkspaceTarget;
  relayBinaryFor: SshSettings["relayBinaryFor"];
}): () => Promise<RelayClient> {
  const { target } = options;
  let machine: HostInfo | undefined;
  return async () => {
    const firstTime = machine === undefined;
    machine ??= await target.inspect();
    // A reconnect (sleep, network) keeps the relay that is installed even when dist/ has since been
    // left behind by edits; only the first connection of this app run insists on a current build.
    if (firstTime) await installOn({ ...options, machine });
    else await installOn({ ...options, machine, ignoreStale: true });
    const capture = { explain: (stderr: string) => target.explainFailure(stderr) };
    const path = await target.loginPath();
    return relayClientOver(spawnBridge({ argv: target.bridgeCommand({ path }), capture }));
  };
}

/**
 * What to do when a machine's relay is not the app's own (another version, or the same version
 * started from other code): stop it if none of its sessions is working, so that the next
 * connection starts the app's relay; otherwise leave it running and used as it is, and say so
 * (the user can restart it, which ends those sessions).
 */
export function replaceOldRelay(target: Pick<WorkspaceTarget, "stopRelay">): ReplaceRelay {
  return async ({ client, mismatch }) => {
    const { sessions } = await client.call(RelayName.sessionsList, {});
    const busy = sessions.filter(
      (session) => session.turnRunning || session.pendingPermissions.length > 0,
    );
    if (busy.length > 0) {
      const working = `${String(busy.length)} ${busy.length === 1 ? "session is" : "sessions are"} still working on it`;
      const reason = `${mismatch} ${working}, so it was left running. Restart it when they are done, or use Restart relay to end them now (they can be resumed).`;
      return { replaced: false, reason };
    }
    await target.stopRelay();
    return { replaced: true, reason: "" };
  };
}
