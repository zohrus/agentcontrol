import type { SessionEvent } from "@agentcontrol/protocol";
import { useMemo } from "react";
import { buildViewItems, Composer, isTurnRunning, Stream } from "../session-view/index.ts";

type Props = {
  events: readonly SessionEvent[];
  /** False while a change is being made or waits for Keep or Undo: the agent takes no new request. */
  canSend: boolean;
  onSendPrompt: (text: string) => void;
};

const modifyActions = { onAnswerPermission: () => undefined };
const noop = () => undefined;

/** The conversation with the Modify agent: the session stream plus a prompt box. */
export function ModifyChat({ events, canSend, onSendPrompt }: Props) {
  // The relay answers this agent's requests by itself: a card with buttons would only mislead.
  const items = useMemo(
    () =>
      buildViewItems(events).filter(
        (item) => item.type !== "permission" || item.answer !== undefined,
      ),
    [events],
  );
  return (
    <>
      <Stream items={items} actions={modifyActions} />
      {canSend && (
        <Composer
          running={isTurnRunning(events)}
          placeholder="Describe a change to this UI…"
          onSendPrompt={onSendPrompt}
          onCancel={noop}
        />
      )}
    </>
  );
}
