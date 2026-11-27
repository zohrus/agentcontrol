import { useState } from "react";
import { ArchiveDialog } from "../archive/index.ts";
import {
  sameSession,
  type SessionRef,
  useController,
  useSession,
  useSessionEntries,
} from "../data/index.ts";
import { nextSessionAfter } from "./next-session.ts";
import { clearSelectionIf } from "./use-selected-session.ts";

/** The session being archived, and the unsaved files the app named (none until it refused). */
type Target = { ref: SessionRef; files: readonly string[] };

/** Which session is open, and how to open another one. */
type Navigation = { selected: SessionRef | undefined; select: (ref: SessionRef) => void };

/** Moves the view on from the open session when it is archived: to the next one, or to none. */
function useMoveOn({ selected, select }: Navigation) {
  const entries = useSessionEntries();
  return (ref: SessionRef): void => {
    if (!sameSession(selected, ref)) return;
    const next = nextSessionAfter(entries, ref);
    if (next) select(next);
    else clearSelectionIf(ref);
  };
}

/**
 * Archiving: the user confirms first, and the session is gone from the list at once (the view
 * moves on to the next session). When the worktree has unsaved changes the app refuses: the
 * session is back, and the dialog opens again listing the files and offering "Archive anyway".
 */
export function useArchiveFlow(navigation: Navigation) {
  const controller = useController();
  const moveOn = useMoveOn(navigation);
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
      const { ref } = chosen;
      const wasOpen = sameSession(navigation.selected, ref);
      moveOn(ref);
      const outcome = await controller.archive(ref, chosen.files.length > 0);
      if (outcome.status !== "blocked") return;
      setTarget({ ref, files: outcome.files });
      if (wasOpen) navigation.select(ref);
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
