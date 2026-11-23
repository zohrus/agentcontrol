import { useState } from "react";
import { useController, useSessionEntries } from "../data/index.ts";
import { SessionList, type SessionRef } from "../session-list/index.ts";

type Props = { selected: SessionRef | undefined; onSelect: (ref: SessionRef) => void };

/** The session list, with Approve and Deny wired to the agent. */
export function SessionsPane({ selected, onSelect }: Props) {
  const entries = useSessionEntries();
  const controller = useController();
  const [showArchived, setShowArchived] = useState(false);
  return (
    <SessionList
      entries={entries}
      selected={selected}
      onSelect={onSelect}
      showArchived={showArchived}
      onShowArchivedChange={setShowArchived}
      onAnswerPermission={(ref, requestId, optionId) => {
        void controller.answerPermission(ref.id, requestId, optionId);
      }}
    />
  );
}
