import { join } from "node:path";
import type { AppAccess, Session } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";
import type { SshHost } from "../setup/ssh-host.ts";

/** The session is listed under the workspace it was started on. */
export async function expectSessionOnWorkspace(
  app: AppAccess,
  call: { session: Session; workspace: { id: string } },
): Promise<void> {
  const listed = (await app.sdk.sessions.list()).find((each) => each.id === call.session.id);
  if (listed?.workspaceId !== call.workspace.id) {
    throw new Error(
      `expected session "${call.session.title}" to be on workspace ${call.workspace.id}, but it is on ${listed?.workspaceId ?? "no listed workspace"}`,
    );
  }
}

/** The session is listed under "This Mac". */
export function expectSessionOnThisMac(app: AppAccess, session: Session): Promise<void> {
  return expectSessionOnWorkspace(app, { session, workspace: { id: "local" } });
}

/** The removed workspace's session is still listed under it, and its history can be read. */
export async function expectPastSessionToStayReadable(
  app: AppAccess,
  call: { session: Session; workspace: { id: string } },
): Promise<void> {
  expectListToHold(await app.sdk.sessions.list(), [call.session]);
  await expectSessionOnWorkspace(app, call);
  const history = await app.sdk.sessions.events(call.session.id);
  expectHistoryToBeReadable(history);
}

/** The session list holds all of these sessions. */
export function expectListToHold(listed: Array<{ id: string }>, sessions: Session[]): void {
  const missing = sessions.filter((session) => !listed.some((each) => each.id === session.id));
  if (missing.length > 0) {
    throw new Error(
      `expected the session list to hold "${missing.map((each) => each.title).join('", "')}", but it does not`,
    );
  }
}

/** The session's history has events to read. */
function expectHistoryToBeReadable(history: unknown[]): void {
  if (history.length === 0)
    throw new Error("expected the session's history to be readable, but it is empty");
}

/** The host's own relay holds the session's log, so the agent ran there and not on this machine. */
export async function expectHostToHoldTheSession(host: SshHost, session: Session): Promise<void> {
  const log = join(host.relayDataDir, "sessions", session.id, "events.jsonl");
  const there = await Bun.file(log).exists();
  if (!there)
    throw new Error(
      `expected the host's relay to hold session "${session.title}", but it does not`,
    );
}

/** The host's own log shows the turn ended, whether or not the app was connected when it did. */
export async function expectHostToHaveFinishedTheTurn(
  host: SshHost,
  session: Session,
): Promise<void> {
  const log = join(host.relayDataDir, "sessions", session.id, "events.jsonl");
  const expectation = `expected the host to have finished the turn of session "${session.title}"`;
  await eventually(expectation, async () => {
    const text = await Bun.file(log)
      .text()
      .catch(() => "");
    return text.includes('"kind":"turn-ended"') ? undefined : "its log shows no end of turn yet";
  });
}
