import type { DiffResult } from "@agentcontrol/sdk";
import { useState } from "react";
import { ChangesPanel } from "../changes/index.ts";
import {
  type SessionRef,
  useChangesError,
  useController,
  useDiff,
  useFile,
  useOpenFile,
  useSession,
  useSessionEvents,
  useTree,
  useTurnRunning,
  useWorkspace,
  worktreePathOf,
} from "../data/index.ts";
import { canTakeCommands } from "../workspaces/index.ts";

const NO_FILE = { base: "", working: "", notice: undefined };

function Message({ text }: { text: string }) {
  return <p className="m-0 p-4 text-xs text-muted">{text}</p>;
}

/** Files cannot be edited while the agent works, or when the session's workspace is not usable. */
function useFrozen(id: SessionRef): boolean {
  const workspace = useWorkspace(id.workspaceId);
  const unusable = workspace !== undefined && !canTakeCommands(workspace);
  return useTurnRunning(id) || unusable;
}

/** Saving the open file; saves can overlap (the user keeps typing), so "Saving…" lasts until the last is answered. */
function useSaving(call: { id: SessionRef; path: string | undefined }) {
  const controller = useController();
  const [count, setCount] = useState(0);
  const { id, path } = call;
  const save = (content: string) => {
    if (path === undefined) return;
    setCount((n) => n + 1);
    void controller.saveFile(id, path, content).finally(() => {
      setCount((n) => n - 1);
    });
  };
  return { saving: count > 0, save };
}

function Loaded(props: { id: SessionRef; diff: DiffResult; showChangesTab: number }) {
  const { id, diff } = props;
  const events = useSessionEvents(id);
  const [picked, setPicked] = useState<string>();
  const path = picked ?? diff.files[0]?.path;
  useOpenFile(id, path);
  const file = useFile(id, path) ?? NO_FILE;
  const tree = useTree(id);
  const frozen = useFrozen(id);
  const { saving, save } = useSaving({ id, path });
  return (
    <ChangesPanel
      sessionId={id.id}
      diff={diff}
      tree={tree}
      selectedPath={path}
      onSelectPath={setPicked}
      baseContent={file.base}
      workingContent={file.working}
      notice={file.notice}
      worktreePath={worktreePathOf(events) ?? ""}
      showChangesTab={props.showChangesTab}
      readOnly={frozen}
      saving={saving}
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

/**
 * The open session's changes: the diff, and an editor for its files. Remount it per session.
 * `showChangesTab` goes up each time something asks to see the changes.
 */
export function ChangesPane({
  id,
  showChangesTab,
}: {
  id: SessionRef | undefined;
  showChangesTab: number;
}) {
  const summary = useSession(id);
  const reason = unavailableReason(summary, useChangesError(id));
  const diff = useDiff(id);
  if (reason !== undefined) return <Message text={reason} />;
  if (id === undefined || !diff) return <Message text="Loading changes…" />;
  return <Loaded id={id} diff={diff} showChangesTab={showChangesTab} />;
}
