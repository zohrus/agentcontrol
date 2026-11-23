import { useState } from "react";
import { ArchiveDialog } from "../archive/index.ts";
import { type SessionRef, useController, useSession } from "../data/index.ts";

/** The session being archived, and the unsaved files the app named (none until it refused). */
type Target = { ref: SessionRef; files: readonly string[] };

/**
 * Archiving: the user confirms first. When the worktree has unsaved changes the app refuses, and
 * the dialog opens again listing the files and offering "Archive anyway".
 */
export function useArchiveFlow() {
  const controller = useController();
  const [target, setTarget] = useState<Target>();
  return {
    target,
    request: (ref: SessionRef): void => {
      setTarget({ ref, files: [] });
    },
    close: () => {
      setTarget(undefined);
    },
    confirm: async (chosen: Target): Promise<void> => {
      const force = chosen.files.length > 0;
      const outcome = await controller.archive(chosen.ref.id, force);
      if (outcome.status === "blocked") setTarget({ ref: chosen.ref, files: outcome.files });
    },
  };
}

type Flow = ReturnType<typeof useArchiveFlow>;

function TargetDialog({ target, flow }: { target: Target; flow: Flow }) {
  const title = useSession(target.ref)?.title ?? "this session";
  return (
    <ArchiveDialog
      open
      onOpenChange={(open) => {
        if (!open) flow.close();
      }}
      sessionTitle={title}
      uncommittedFiles={target.files}
      onArchive={() => void flow.confirm(target)}
    />
  );
}

/** The archive confirmation, and the warning listing files that would be lost. */
export function ArchiveFlowDialog({ flow }: { flow: Flow }) {
  return flow.target ? <TargetDialog target={flow.target} flow={flow} /> : null;
}
