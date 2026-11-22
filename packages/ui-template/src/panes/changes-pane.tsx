import type { DiffResult, SessionId } from "@agentcontrol/sdk";
import { useState } from "react";
import { ChangesPanel } from "../changes/index.ts";
import {
  useChangesError,
  useController,
  useDiff,
  useFile,
  useOpenFile,
  useSession,
  useSessionEvents,
  useTree,
  worktreePathOf,
} from "../data/index.ts";
import { isTurnRunning } from "../session-view/index.ts";

const NO_FILE = { base: "", working: "", notice: undefined };

function Message({ text }: { text: string }) {
  return <p className="m-0 p-4 text-xs text-muted">{text}</p>;
}

function Loaded({ id, diff }: { id: SessionId; diff: DiffResult }) {
  const controller = useController();
  const events = useSessionEvents(id);
  const [picked, setPicked] = useState<string>();
  const path = picked ?? diff.files[0]?.path;
  useOpenFile(id, path);
  const file = useFile(id, path) ?? NO_FILE;
  const tree = useTree(id);
  const save = (content: string) => {
    if (path !== undefined) void controller.saveFile(id, path, content);
  };
  return (
    <ChangesPanel
      diff={diff}
      tree={tree}
      selectedPath={path}
      onSelectPath={setPicked}
      baseContent={file.base}
      workingContent={file.working}
      notice={file.notice}
      worktreePath={worktreePathOf(events) ?? ""}
      readOnly={isTurnRunning(events)}
      onSave={save}
    />
  );
}

function unavailableReason(summary: { status: string } | undefined, error: string | undefined) {
  if (!summary) return "Open a session to see its changes.";
  if (summary.status === "archived") {
    return "This session is archived. Its working copy was removed; the branch keeps the changes.";
  }
  return error;
}

/** The open session's changes: the diff, and an editor for its files. Remount it per session. */
export function ChangesPane({ id }: { id: SessionId | undefined }) {
  const reason = unavailableReason(useSession(id), useChangesError(id));
  const diff = useDiff(id);
  if (reason !== undefined) return <Message text={reason} />;
  if (id === undefined || !diff) return <Message text="Loading changes…" />;
  return <Loaded id={id} diff={diff} />;
}
