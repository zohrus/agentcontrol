import { access, constants } from "node:fs/promises";
import { eventually } from "../setup/eventually.ts";
import type { ForwardOutcome } from "../setup/ssh-forwarding.ts";
import type { SshHost } from "../setup/ssh-host.ts";

/** The relay binary of the app's version is in place on the host and can be run. */
export async function expectRelayInstalledOnHost(host: SshHost): Promise<void> {
  await access(host.installedRelay, constants.X_OK).catch(() => {
    throw new Error(
      `expected the relay to be installed at ${host.installedRelay} on the host, but it is not`,
    );
  });
}

/** The relay on the host is not the old one any more: it was stopped and a new one started. */
export async function expectHostRelayToHaveBeenReplaced(
  host: SshHost,
  old: { pid: number },
): Promise<void> {
  await eventually(
    "expected the host's relay to have been replaced",
    async () => {
      const pid = await host.relayPid();
      return pid !== undefined && pid !== old.pid
        ? undefined
        : "the old relay is still the one running";
    },
    30_000,
  );
}

/** The old relay is still the one running on the host, with whatever it was doing. */
export async function expectHostRelayToBeUntouched(
  host: SshHost,
  old: { pid: number },
): Promise<void> {
  const pid = await host.relayPid();
  if (pid !== old.pid) {
    throw new Error(
      `expected the old relay (pid ${String(old.pid)}) to still run on the host, but the relay is ${String(pid)}`,
    );
  }
}

/** What the program at the end of a forwarded port said is exactly this. */
export function expectGreetingToBe(heard: string, wanted: string): void {
  if (heard !== wanted) {
    throw new Error(
      `expected the forwarded port to reach "${wanted}", but it said ${JSON.stringify(heard)}`,
    );
  }
}

/** Forwarding the port failed, and the reason is this. */
export function expectForwardingToFail(outcome: ForwardOutcome, saying: string): void {
  if (outcome.forwarded || !outcome.reason.includes(saying)) {
    const found = outcome.forwarded ? "it worked" : outcome.reason;
    throw new Error(`expected forwarding to fail saying "${saying}", but ${found}`);
  }
}
