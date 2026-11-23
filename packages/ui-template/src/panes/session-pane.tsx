import {
  type SessionRef,
  useController,
  useData,
  useSession,
  useSessionEvents,
  useUsage,
  useWorkspace,
} from "../data/index.ts";
import { SessionView } from "../session-view/index.ts";
import { readOnlyNote } from "../workspaces/index.ts";
import { EmptyState } from "./empty-state.tsx";

type Props = {
  selected: SessionRef | undefined;
  onNewSession: () => void;
  onArchive: (ref: SessionRef) => void;
};

type OpenProps = { selected: SessionRef; onArchive: (ref: SessionRef) => void };

function Missing({ loaded }: { loaded: boolean }) {
  return <p className="p-4 text-muted">{loaded ? "That session no longer exists." : "Loading…"}</p>;
}

function OpenSession({ selected, onArchive }: OpenProps) {
  const controller = useController();
  const loaded = useData((s) => s.loaded);
  const summary = useSession(selected);
  const events = useSessionEvents(selected);
  const usage = useUsage(selected);
  const workspace = useWorkspace(selected.workspaceId);
  if (!summary) return <Missing loaded={loaded} />;
  return (
    <SessionView
      summary={summary}
      events={events}
      turnRunning={summary.turnRunning}
      usage={usage}
      readOnlyNote={workspace && readOnlyNote(workspace)}
      onSendPrompt={(text) => void controller.sendPrompt(selected.id, text)}
      onCancel={() => void controller.cancel(selected.id)}
      onResume={() => void controller.resume(selected.id)}
      onArchive={() => {
        onArchive(selected);
      }}
      onAnswerPermission={(requestId, optionId) => {
        void controller.answerPermission(selected.id, requestId, optionId);
      }}
    />
  );
}

/** The open session's stream and composer, or a guide when none is open. */
export function SessionPane({ selected, onNewSession, onArchive }: Props) {
  if (selected === undefined) return <EmptyState onNewSession={onNewSession} />;
  return <OpenSession selected={selected} onArchive={onArchive} />;
}
