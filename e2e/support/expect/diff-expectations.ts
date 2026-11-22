import { RelayName } from "@agentcontrol/protocol";
import type { RelayAccess, Session } from "../setup/relay.ts";

/** The session's diff against its base branch lists this file as changed. */
export async function expectDiffToListChangedFile(
  relay: RelayAccess,
  session: Session,
  path: string,
): Promise<void> {
  const { files } = await relay.call(RelayName.diff, { sessionId: session.id });
  if (files.some((file) => file.path === path)) return;
  const listed = files.map((file) => file.path).join(", ") || "nothing";
  throw new Error(
    `expected the diff of session "${session.title}" to list ${path}, but it lists ${listed}`,
  );
}
