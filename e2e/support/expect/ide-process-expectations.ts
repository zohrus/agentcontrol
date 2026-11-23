import { join } from "node:path";
import type { AppAccess, Session } from "../setup/app.ts";
import type { FakeInvocation } from "../setup/ide-user.ts";
import { expectCodeServersStarted } from "./ide-expectations.ts";
import { expectProcessToBeGone, worktreeOf } from "./terminal-expectations.ts";

/** One code-server per session, each opened on its own session's worktree. */
export async function expectOneCodeServerPerWorktree(
  call: { app: AppAccess; relayDataDir: string },
  sessions: Session[],
): Promise<void> {
  const started = await expectCodeServersStarted(call.relayDataDir, sessions.length);
  const wanted = await Promise.all(sessions.map((session) => worktreeOf(call.app, session)));
  const folders = started.map((one) => one.folder).sort();
  if (folders.join("\n") !== wanted.sort().join("\n")) {
    throw new Error(
      `expected one code-server on each session's worktree (${wanted.join(", ")}), but they were opened on ${folders.join(", ")}`,
    );
  }
}

/** Both code-servers keep their settings and extensions in the workspace's folder, shared. */
export function expectSharedSettingsAndExtensions(
  relayDataDir: string,
  started: FakeInvocation[],
): void {
  const flagsOf = (one: FakeInvocation, name: string): string => {
    return one.argv[one.argv.indexOf(name) + 1] ?? "";
  };
  const wanted = {
    "--user-data-dir": join(relayDataDir, "ide", "user-data"),
    "--extensions-dir": join(relayDataDir, "ide", "extensions"),
  };
  for (const [name, folder] of Object.entries(wanted)) {
    const given = started.map((one) => flagsOf(one, name));
    if (given.some((path) => path !== folder)) {
      throw new Error(
        `expected every code-server to use ${name} ${folder}, but they got ${given.join(", ")}`,
      );
    }
  }
}

/** The code-server process and the helper it started (an extension host) are both gone. */
export async function expectCodeServerToBeGone(one: FakeInvocation): Promise<void> {
  await expectProcessToBeGone(one.pid, "code-server");
  await expectProcessToBeGone(one.helperPid, "the process code-server started");
}

/** A code-server process is running. */
function expectProcessToRun(pid: number, who: string): void {
  try {
    process.kill(pid, 0);
  } catch {
    throw new Error(`expected ${who} (process ${String(pid)}) to be running, but it is gone`);
  }
}

/** The process is still running after this long, with nothing keeping it but a connection. */
export async function expectCodeServerToKeepRunning(
  one: FakeInvocation,
  forMs: number,
): Promise<void> {
  await Bun.sleep(forMs);
  expectProcessToRun(one.pid, "code-server");
}
