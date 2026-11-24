import { ErrorCode, type FsReadParams, RelayName } from "@agentcontrol/protocol";
import type { Outcome } from "../setup/attempt.ts";
import type { RelayAccess, Session } from "../setup/relay.ts";

/** Reading the file at this version gives exactly this content. */
export async function expectFileToRead(
  relay: RelayAccess,
  call: { session: Session; path: string; ref: FsReadParams["ref"]; content: string },
): Promise<void> {
  const { session, path, ref, content } = call;
  await relay.events.waitFor(
    (event) => event.sessionId === session.id && event.kind === "setup-finished",
    `expected the worktree of session "${session.title}" to be made`,
  );
  const read = await relay.call(RelayName.fsRead, { sessionId: session.id, path, ref });
  if (read.content !== content) {
    throw new Error(
      `expected ${path} at ${ref} to read ${JSON.stringify(content)}, but it reads ${JSON.stringify(read.content)}`,
    );
  }
}

/** The relay refused the call because the path leads outside the session's worktree. */
export function expectPathToBeRefusedAsOutsideTheWorktree(outcome: Outcome<unknown>): void {
  if (outcome.ok) {
    throw new Error("expected a path outside the worktree to be refused, but it was read");
  }
  if (!outcome.message.includes("outside the session's folder")) {
    throw new Error(
      `expected a refusal naming the session's folder, but it said: ${outcome.message}`,
    );
  }
}

/** The relay refused the save because the file changed since the user read it. */
export function expectSaveToBeRefusedAsStale(outcome: Outcome<unknown>): void {
  if (outcome.ok) throw new Error("expected the save with an old hash to be refused, but it saved");
  if (outcome.code !== ErrorCode.staleFile) {
    throw new Error(`expected the save to be refused as stale, but it said: ${outcome.message}`);
  }
}

/** The relay handed over exactly these bytes. */
export function expectBytesToBeRead(outcome: Outcome<{ base64: string }>, bytes: Uint8Array): void {
  if (!outcome.ok)
    throw new Error(`expected the bytes to be read, but it said: ${outcome.message}`);
  if (outcome.value.base64 !== Buffer.from(bytes).toString("base64")) {
    throw new Error("expected the bytes of the file to come back unchanged, but they differ");
  }
}

/** The relay refused to hand the file's bytes over, with this error code. */
export function expectBytesToBeRefused(outcome: Outcome<unknown>, wanted: number): void {
  if (outcome.ok)
    throw new Error("expected the relay to refuse the bytes, but it handed them over");
  if (outcome.code !== wanted) {
    throw new Error(
      `expected the refusal to have code ${String(wanted)}, but it said: ${outcome.message}`,
    );
  }
}

/** The app was told that this path changed in the session's worktree. */
export async function expectFileChangeNotification(
  relay: RelayAccess,
  call: { session: Session; path: string },
): Promise<void> {
  const { session, path } = call;
  await relay.fileChanges.waitFor(
    (change) => change.sessionId === session.id && change.paths.includes(path),
    `expected the app to be told that ${path} changed in session "${session.title}"`,
  );
}
