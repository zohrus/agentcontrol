import type { DiffResult, FsEntry, SessionRow } from "@agentcontrol/sdk";
import type { AppAccess, Session } from "../setup/app.ts";

/** The session summary the app shows has the title the user gave it. */
export function expectSessionShownWithTitle(summary: SessionRow, session: Session): void {
  if (summary.title !== session.title) {
    throw new Error(
      `expected the session to be titled "${session.title}", but it is "${summary.title}"`,
    );
  }
}

/** The file tree lists this file. */
export function expectTreeToList(entries: FsEntry[], path: string): void {
  if (entries.some((entry) => entry.path === path && entry.kind === "file")) return;
  const listed = entries.map((entry) => entry.path).join(", ");
  throw new Error(`expected the file tree to list ${path}, but it lists ${listed}`);
}

/** The diff lists this file as changed. */
export function expectDiffToList(diff: DiffResult, path: string): void {
  if (diff.files.some((file) => file.path === path)) return;
  const listed = diff.files.map((file) => file.path).join(", ") || "nothing";
  throw new Error(`expected the diff to list ${path}, but it lists ${listed}`);
}

/** The live stream told the browser that this path changed in the session's worktree. */
export async function expectLiveStreamToReportChange(
  app: AppAccess,
  call: { session: Session; path: string },
): Promise<void> {
  const { session, path } = call;
  await app.fileChanges.waitFor(
    (change) => change.sessionId === session.id && change.paths.includes(path),
    `expected the live stream to report that ${path} changed in session "${session.title}"`,
  );
}
