import { access, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SessionEvent } from "@agentcontrol/sdk";
import type { AppAccess, Session } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";
import { git } from "../setup/git.ts";
import { worktreeFolderOf } from "../setup/start-archive-setups.ts";

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

const isSetupLine = (event: SessionEvent, text: string): boolean =>
  event.kind === "setup-output" && event.payload.text.includes(text);

/** The session's setup output (start or archive steps) says each of these lines, in the live stream. */
export async function expectSessionToSay(
  app: AppAccess,
  call: { session: Session; lines: string[] },
): Promise<void> {
  const { session, lines } = call;
  for (const line of lines) {
    await app.streamed.waitFor(
      (event) => event.sessionId === session.id && isSetupLine(event, line),
      `expected session "${session.title}" to say "${line}"`,
    );
  }
}

/** The session's step is announced as running, and has not ended. */
export async function expectStepToBeRunning(
  app: AppAccess,
  call: { session: Session; step: string },
): Promise<void> {
  const { session, step } = call;
  await app.streamed.waitFor(
    (event) =>
      event.sessionId === session.id &&
      event.kind === "setup-output" &&
      event.payload.step?.id === step &&
      event.payload.step.state === "running",
    `expected step "${step}" of session "${session.title}" to be running`,
  );
  const events = await app.sdk.sessions.events(session.id, { after: 0 });
  const ended = events.find(
    (event) =>
      event.kind === "setup-output" &&
      event.payload.step?.id === step &&
      event.payload.step.state !== "running",
  );
  if (ended !== undefined) {
    throw new Error(
      `expected step "${step}" of session "${session.title}" to be running, but it ended`,
    );
  }
}

/** The agent's adapter has answered ACP `initialize`, whatever else the session is doing. */
export async function expectAgentToHaveAnsweredInitialize(
  app: AppAccess,
  session: Session,
): Promise<void> {
  await app.streamed.waitFor(
    (event) =>
      event.sessionId === session.id &&
      event.kind === "acp" &&
      event.payload.direction === "from-agent" &&
      "result" in event.payload.message &&
      JSON.stringify(event.payload.message).includes("protocolVersion"),
    `expected the agent of session "${session.title}" to have answered initialize`,
  );
}

/** The session has not got as far as this setup line (it is not in its events yet). */
export async function expectSessionNotToHaveSaid(
  app: AppAccess,
  call: { session: Session; line: string },
): Promise<void> {
  const events = await app.sdk.sessions.events(call.session.id, { after: 0 });
  if (!events.some((event) => isSetupLine(event, call.line))) return;
  throw new Error(
    `expected session "${call.session.title}" not to have said "${call.line}" yet, but it has`,
  );
}

/** Where an archived session's folder waits to be deleted: next to the worktrees. */
const waitingFolder = (worktree: string): string => join(dirname(worktree), ".deleting");

/** The session's worktree folder is no longer in place, but its files still wait to be deleted. */
export async function expectFilesToWaitForDeletion(
  app: AppAccess,
  session: Session,
): Promise<void> {
  const worktree = await worktreeFolderOf(app, session);
  if (await exists(worktree)) {
    throw new Error(
      `expected the worktree of "${session.title}" to be moved out of place, but it is there`,
    );
  }
  const waiting = await readdir(waitingFolder(worktree)).catch(() => [] as string[]);
  if (waiting.length === 0) {
    throw new Error(
      `expected the files of "${session.title}" to wait for deletion, but nothing waits`,
    );
  }
}

/** Nothing waits for deletion any more: everything that was moved aside is gone. */
export async function expectNothingToWaitForDeletion(
  app: AppAccess,
  session: Session,
): Promise<void> {
  const folder = waitingFolder(await worktreeFolderOf(app, session));
  await eventually(`expected the moved worktree folders to be deleted`, async () => {
    const waiting = await readdir(folder).catch(() => [] as string[]);
    return waiting.length === 0 ? undefined : `${String(waiting.length)} still wait in ${folder}`;
  });
}

/** Git no longer lists the session's worktree, and its branch is still there. */
export async function expectGitToForgetTheWorktreeButKeepTheBranch(
  app: AppAccess,
  session: Session,
): Promise<void> {
  const worktree = await worktreeFolderOf(app, session);
  const listed = await git(app.repoPath, "worktree", "list", "--porcelain");
  if (listed.includes(worktree)) {
    throw new Error(
      `expected git to forget the worktree of "${session.title}", but it still lists it`,
    );
  }
  const { branch } = await app.sdk.sessions.get(session.id);
  if ((await git(app.repoPath, "branch", "--list", branch)).trim() === "") {
    throw new Error(`expected branch "${branch}" to be kept, but it is gone`);
  }
}

/** The session is listed as archived. */
export async function expectSessionToBeArchived(app: AppAccess, session: Session): Promise<void> {
  const row = await app.sdk.sessions.get(session.id);
  if (row.status === "archived") return;
  throw new Error(`expected session "${session.title}" to be archived, but it is ${row.status}`);
}

/** The agent was killed (signal SIGKILL) because it ignored the request to stop. */
export async function expectAgentToHaveBeenKilled(app: AppAccess, session: Session): Promise<void> {
  await app.streamed.waitFor(
    (event) =>
      event.sessionId === session.id &&
      event.kind === "agent-exited" &&
      event.payload.signal === "SIGKILL",
    `expected the agent of session "${session.title}" to be killed after it ignored the request to stop`,
  );
}
