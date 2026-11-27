import {
  changeTotalsOf,
  type SessionRef,
  useAnswering,
  useController,
  useData,
  useDiff,
  useInFlight,
  useOutgoing,
  useSession,
  useSessionEvents,
  useUsage,
  useWorkspace,
} from "../data/index.ts";
import { SessionView } from "../session-view/index.ts";
import { readOnlyNote } from "../workspaces/index.ts";
import { EmptyState } from "./empty-state.tsx";

type OpenProps = {
  selected: SessionRef;
  onArchive: (ref: SessionRef) => void;
  /** Shows the session's changes in the right-hand panel. */
  onShowChanges: () => void;
};

type Props = Omit<OpenProps, "selected"> & {
  selected: SessionRef | undefined;
  onNewSession: () => void;
};

function Missing({ loaded }: { loaded: boolean }) {
  return <p className="p-4 text-muted">{loaded ? "That session no longer exists." : "Loading…"}</p>;
}

/** What the user sent or started on the session that the app has not answered yet. */
function usePending(selected: SessionRef) {
  return {
    outgoing: useOutgoing(selected),
    inFlight: useInFlight(selected),
    answering: useAnswering(),
  };
}

/** What the buttons of the open session do. */
function useSessionActions(selected: SessionRef) {
  const controller = useController();
  return {
    onSendPrompt: (text: string) => void controller.sendPrompt(selected, text),
    onRetryMessage: (localId: string) => void controller.retryPrompt(selected, localId),
    onDismissMessage: (localId: string) => {
      controller.dismissPrompt(selected, localId);
    },
    onCancel: () => void controller.cancel(selected),
    onResume: () => void controller.resume(selected),
    onAnswerPermission: (requestId: string, optionId: string) => {
      void controller.answerPermission(selected.id, requestId, optionId);
    },
  };
}

function OpenSession({ selected, onArchive, onShowChanges }: OpenProps) {
  const loaded = useData((s) => s.loaded);
  const summary = useSession(selected);
  const events = useSessionEvents(selected);
  const usage = useUsage(selected);
  const diff = useDiff(selected);
  const workspace = useWorkspace(selected.workspaceId);
  const actions = useSessionActions(selected);
  const pending = usePending(selected);
  if (!summary) return <Missing loaded={loaded} />;
  return (
    <SessionView
      summary={summary}
      events={events}
      turnRunning={summary.turnRunning}
      usage={usage}
      changes={diff && changeTotalsOf(diff)}
      onShowChanges={onShowChanges}
      readOnlyNote={workspace && readOnlyNote(workspace)}
      {...pending}
      {...actions}
      onArchive={() => {
        onArchive(selected);
      }}
    />
  );
}

/** The open session's stream and composer, or a guide when none is open. */
export function SessionPane({ selected, onNewSession, ...actions }: Props) {
  if (selected === undefined) return <EmptyState onNewSession={onNewSession} />;
  return <OpenSession selected={selected} {...actions} />;
}
