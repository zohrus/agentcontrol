import type { AppAccess } from "../setup/app.ts";
import { codeServersStartedBy } from "../setup/ide-user.ts";
import { relayDataOf } from "../setup/ide-setups.ts";
import type { SshHost } from "../setup/ssh-host.ts";
import { expectOneCodeServerStarted } from "./ide-expectations.ts";

/** One code-server was started by the host's relay, with the host's home as its own. */
export async function expectCodeServerRanOnTheHost(host: SshHost): Promise<void> {
  const running = await expectOneCodeServerStarted(host.relayDataDir);
  const onHost = running.home === host.home && running.folder.startsWith(host.home);
  if (!onHost) {
    throw new Error(
      `expected code-server to run on the host (home ${host.home}) in a worktree there, but it ran with home ${running.home} on ${running.folder}`,
    );
  }
}

/** This machine's own relay never started a code-server. */
export async function expectNoCodeServerOnThisMachine(app: AppAccess): Promise<void> {
  const started = await codeServersStartedBy(relayDataOf(app));
  if (started.length > 0) {
    throw new Error(
      `expected no code-server on this machine, but ${String(started.length)} started`,
    );
  }
}
