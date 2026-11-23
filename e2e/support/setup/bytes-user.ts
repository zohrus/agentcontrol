import { mkdir, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { RelayName } from "@agentcontrol/protocol";
import { attempt } from "./attempt.ts";
import type { RelayAccess, Session } from "./relay.ts";
import { worktreeOf } from "./session-events.ts";

/** Raw file bytes in a session's worktree, as relay calls. */
export function bytesUserOf(relay: RelayAccess) {
  return {
    /** The raw bytes of a working-copy file, as base64. */
    triesToReadBytesOf: (session: Session, path: string) =>
      attempt(relay.call(RelayName.fsReadBytes, { sessionId: session.id, path })),
    /** Puts a file into the session's worktree from outside the app, as an editor would. */
    putsFileInTheWorktree: async (session: Session, file: { path: string; bytes: Uint8Array }) => {
      const target = join(await worktreeOf(relay, session), file.path);
      await mkdir(dirname(target), { recursive: true });
      await Bun.write(target, file.bytes);
    },
    /** Adds a link inside the session's worktree that leads to another file of it. */
    linksInTheWorktree: async (session: Session, link: { from: string; to: string }) => {
      await symlink(link.to, join(await worktreeOf(relay, session), link.from));
    },
  };
}
