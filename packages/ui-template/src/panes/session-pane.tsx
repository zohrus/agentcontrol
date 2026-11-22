import type { SessionId } from "@agentcontrol/protocol";
import { useController, useData, useSession, useSessionEvents, useUsage } from "../data/index.ts";
import { SessionView } from "../session-view/index.ts";
import { EmptyState } from "./empty-state.tsx";

type Props = {
  id: SessionId | undefined;
  onNewSession: () => void;
  onArchive: (id: SessionId) => void;
};

/** The open session's stream and composer, or a guide when none is open. */
export function SessionPane({ id, onNewSession, onArchive }: Props) {
  const controller = useController();
  const loaded = useData((s) => s.loaded);
  const summary = useSession(id);
  const events = useSessionEvents(id);
  const usage = useUsage(id);
  if (id === undefined) return <EmptyState onNewSession={onNewSession} />;
  if (!summary) {
    return (
      <p className="p-4 text-muted">{loaded ? "That session no longer exists." : "Loading…"}</p>
    );
  }
  return (
    <SessionView
      summary={summary}
      events={events}
      usage={usage}
      onSendPrompt={(text) => void controller.sendPrompt(id, text)}
      onCancel={() => void controller.cancel(id)}
      onArchive={() => {
        onArchive(id);
      }}
      onAnswerPermission={(requestId, optionId) => {
        void controller.answerPermission(id, requestId, optionId);
      }}
    />
  );
}
