import { type FsReadParams, RelayName } from "@agentcontrol/protocol";
import { attempt } from "./attempt.ts";
import { bytesUserOf } from "./bytes-user.ts";
import type { RelayAccess, Session } from "./relay.ts";

interface FileRef {
  path: string;
  ref: FsReadParams["ref"];
}

interface FileSave {
  path: string;
  content: string;
  /** The hash the user last saw when reading the file. */
  hash: string;
}

/** What a person does with a session's files in the editor, as relay calls. */
export function editorUserOf(relay: RelayAccess) {
  const read = (session: Session, file: FileRef) =>
    relay.call(RelayName.fsRead, { sessionId: session.id, ...file });
  const save = (session: Session, file: FileSave) =>
    relay.call(RelayName.fsWrite, {
      sessionId: session.id,
      path: file.path,
      content: file.content,
      expectedHash: file.hash,
    });
  return {
    readsFile: read,
    triesToReadFile: (session: Session, file: FileRef) => attempt(read(session, file)),
    ...bytesUserOf(relay),
    savesFile: save,
    triesToSaveFile: (session: Session, file: FileSave) => attempt(save(session, file)),
    /** Asks to be told when files in the session's worktree change. */
    watchesFiles: async (session: Session): Promise<void> => {
      await relay.call(RelayName.fsWatch, { sessionId: session.id });
    },
    checksTheWorkspace: () => relay.call(RelayName.workspaceCheck, {}),
    /** The check that also starts each agent for an ACP handshake, as "Add workspace" does. */
    checksTheWorkspaceAndItsAgents: async () => {
      await relay.mockAgent.writeScript();
      return relay.call(RelayName.workspaceCheck, { agents: true });
    },
  };
}
