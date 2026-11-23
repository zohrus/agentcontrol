import { RelayName, VERSION } from "@agentcontrol/protocol";
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
}): Promise<{ installed: boolean }> {
  const { target, machine, relayBinaryFor } = options;
  const binary = relayBinaryFor(machine);
  if (!(await Bun.file(binary).exists())) {
    throw new Error(
      `This app has no relay for ${machine.os} ${machine.arch} (looked for ${binary}).`,
    );
  }
  return target.install(binary);
}

/** Opens connections to a host's relay, installing it first when it is not there yet. */
export function sshConnector(options: {
  target: WorkspaceTarget;
  relayBinaryFor: SshSettings["relayBinaryFor"];
}): () => Promise<RelayClient> {
  const { target } = options;
  return async () => {
    if (!(await target.isInstalled())) {
      await installOn({ ...options, machine: await target.inspect() });
    }
    const capture = { explain: (stderr: string) => target.explainFailure(stderr) };
    const path = await target.loginPath();
    return relayClientOver(spawnBridge({ argv: target.bridgeCommand({ path }), capture }));
  };
}

/**
 * What to do when the host's relay has another version than the app: stop it if none of its
 * sessions is working, so that the next connection starts the app's version; otherwise leave it
 * running and used as it is (the user can restart it).
 */
export function replaceOldRelay(target: Pick<WorkspaceTarget, "stopRelay">): ReplaceRelay {
  return async ({ client, relayVersion }) => {
    const { sessions } = await client.call(RelayName.sessionsList, {});
    const busy = sessions.filter(
      (session) => session.turnRunning || session.pendingPermissions.length > 0,
    );
    if (busy.length > 0) {
      const reason = `The relay is version ${relayVersion}, but this app is version ${VERSION}. ${String(busy.length)} ${busy.length === 1 ? "session is" : "sessions are"} still working on it, so it was left running; restart it when they are done.`;
      return { replaced: false, reason };
    }
    await target.stopRelay();
    return { replaced: true, reason: "" };
  };
}
