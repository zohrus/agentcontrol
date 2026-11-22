import { access, constants } from "node:fs/promises";
import { join } from "node:path";
import type { CheckStep, ConnectionState, WorkspaceInfo } from "@agentcontrol/sdk";
import type { AppAccess, Session } from "../setup/app.ts";
import type { ApiOutcome } from "../setup/app-attempt.ts";
import { eventually } from "../setup/eventually.ts";
import type { SshHost } from "../setup/ssh-host.ts";

/** The workspace is in this connection state, and when it is not good it says why in words. */
export function expectWorkspaceToBe(workspace: WorkspaceInfo, state: ConnectionState): void {
  if (workspace.state !== state) {
    const why = workspace.reason === undefined ? "" : ` (${workspace.reason})`;
    throw new Error(
      `expected workspace "${workspace.label}" to be ${state}, but it is ${workspace.state}${why}`,
    );
  }
}

/** The workspace's reason for not being connected mentions this, in plain words. */
export function expectWorkspaceToExplain(workspace: WorkspaceInfo, saying: string): void {
  if (!workspace.reason?.includes(saying)) {
    throw new Error(
      `expected the reason for workspace "${workspace.label}" to say "${saying}", but it says ${JSON.stringify(workspace.reason)}`,
    );
  }
}

/** The live stream told the app that the workspace reached this state (it is already, or will be). */
export async function expectWorkspaceToBecome(
  app: AppAccess,
  call: { workspace: WorkspaceInfo; state: ConnectionState },
): Promise<void> {
  const { workspace, state } = call;
  await app.workspaceChanges.waitFor(
    (change) => change.id === workspace.id && change.state === state,
    `expected the live stream to say workspace "${workspace.label}" became ${state}`,
  );
}

/** The workspace list shows the workspace in this state, eventually. */
export async function expectWorkspaceListedAs(
  app: AppAccess,
  call: { workspace: WorkspaceInfo; state: ConnectionState },
): Promise<void> {
  const { workspace, state } = call;
  await eventually(`expected workspace "${workspace.label}" to be listed as ${state}`, async () => {
    const listed = (await app.sdk.workspaces.list()).find((each) => each.id === workspace.id);
    return listed?.state === state ? undefined : `it is ${listed?.state ?? "not listed"}`;
  });
}

/** The checklist has every one of these steps, and each passed. */
export function expectChecklistToPass(steps: CheckStep[], ids: string[]): void {
  const notOk = ids.filter((id) => steps.find((step) => step.id === id)?.status !== "ok");
  if (notOk.length > 0) {
    const seen = steps.map((step) => `${step.id}: ${step.status}`).join(", ");
    throw new Error(
      `expected checklist steps ${notOk.join(", ")} to be ok, but the checklist is ${seen}`,
    );
  }
}

/** The relay binary of the app's version is in place on the host and can be run. */
export async function expectRelayInstalledOnHost(host: SshHost): Promise<void> {
  await access(host.installedRelay, constants.X_OK).catch(() => {
    throw new Error(
      `expected the relay to be installed at ${host.installedRelay} on the host, but it is not`,
    );
  });
}

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

/** The host's own relay holds the session's log, so the agent ran there and not on this machine. */
export async function expectHostToHoldTheSession(host: SshHost, session: Session): Promise<void> {
  const log = join(host.relayDataDir, "sessions", session.id, "events.jsonl");
  const there = await Bun.file(log).exists();
  if (!there)
    throw new Error(
      `expected the host's relay to hold session "${session.title}", but it does not`,
    );
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

/** The session is listed under "This Mac". */
export function expectSessionOnThisMac(app: AppAccess, session: Session): Promise<void> {
  return expectSessionOnWorkspace(app, { session, workspace: { id: "local" } });
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

/** The refusal's message, which people read, contains this text. */
export function expectRefusalToSay(outcome: ApiOutcome<unknown>, saying: string): void {
  const message = outcome.ok ? undefined : outcome.message;
  if (!message?.includes(saying)) {
    throw new Error(
      `expected the refusal to say "${saying}", but it says ${JSON.stringify(message)}`,
    );
  }
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

/** The relay on the host is not the old one any more: it was stopped and a new one started. */
export async function expectHostRelayToHaveBeenReplaced(
  host: SshHost,
  old: { pid: number },
): Promise<void> {
  await eventually("expected the host's relay to have been replaced", async () => {
    const pid = await host.relayPid();
    return pid !== undefined && pid !== old.pid
      ? undefined
      : "the old relay is still the one running";
  });
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

/** The session's history has events to read. */
export function expectHistoryToBeReadable(history: unknown[]): void {
  if (history.length === 0)
    throw new Error("expected the session's history to be readable, but it is empty");
}

/** These are exactly the host names offered for adding a workspace. */
export function expectHostAliasesToBe(aliases: string[], wanted: string[]): void {
  if (JSON.stringify(aliases) !== JSON.stringify(wanted)) {
    throw new Error(`expected the host names ${wanted.join(", ")}, but got ${aliases.join(", ")}`);
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
