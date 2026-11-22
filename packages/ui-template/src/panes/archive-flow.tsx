import type { SessionId } from "@agentcontrol/protocol";
import { useState } from "react";
import { ArchiveDialog } from "../archive/index.ts";
import { useController, useSession } from "../data/index.ts";

type Blocked = { id: SessionId; files: readonly string[] };

/**
 * Archiving: the first try is plain; when the worktree has unsaved changes the app refuses, and
 * the dialog lists the files and offers "Archive anyway".
 */
export function useArchiveFlow() {
  const controller = useController();
  const [blocked, setBlocked] = useState<Blocked>();
  return {
    blocked,
    close: () => {
      setBlocked(undefined);
    },
    request: async (id: SessionId): Promise<void> => {
      const outcome = await controller.archive(id, false);
      if (outcome.status === "blocked") setBlocked({ id, files: outcome.files });
    },
    force: (id: SessionId): void => {
      void controller.archive(id, true);
    },
  };
}

type Flow = ReturnType<typeof useArchiveFlow>;

function BlockedDialog({ blocked, flow }: { blocked: Blocked; flow: Flow }) {
  const title = useSession(blocked.id)?.title ?? "this session";
  return (
    <ArchiveDialog
      open
      onOpenChange={(open) => {
        if (!open) flow.close();
      }}
      sessionTitle={title}
      uncommittedFiles={blocked.files}
      onArchive={() => {
        flow.force(blocked.id);
      }}
    />
  );
}

/** The confirmation shown when archiving would lose uncommitted changes. */
export function ArchiveFlowDialog({ flow }: { flow: Flow }) {
  return flow.blocked ? <BlockedDialog blocked={flow.blocked} flow={flow} /> : null;
}
