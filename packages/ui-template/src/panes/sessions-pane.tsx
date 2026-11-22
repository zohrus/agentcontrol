import type { SessionId } from "@agentcontrol/protocol";
import { useState } from "react";
import { useController, useSessionEntries } from "../data/index.ts";
import { SessionList } from "../session-list/index.ts";

type Props = { selectedId: SessionId | undefined; onSelect: (id: SessionId) => void };

/** The session list, with Approve and Deny wired to the agent. */
export function SessionsPane({ selectedId, onSelect }: Props) {
  const entries = useSessionEntries();
  const controller = useController();
  const [showArchived, setShowArchived] = useState(false);
  return (
    <SessionList
      entries={entries}
      selectedId={selectedId}
      onSelect={onSelect}
      showArchived={showArchived}
      onShowArchivedChange={setShowArchived}
      onAnswerPermission={(id, requestId, optionId) => {
        void controller.answerPermission(id, requestId, optionId);
      }}
    />
  );
}
