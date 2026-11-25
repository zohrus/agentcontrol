import type { SessionEvent } from "@agentcontrol/protocol";
import { useMemo } from "react";
import { Composer, isTurnRunning, Stream, useViewItems } from "../session-view/index.ts";

type Props = {
  events: readonly SessionEvent[];
  /** False while a change is being made or waits for Keep or Undo: the agent takes no new request. */
  canSend: boolean;
  /** The request just sent, which the app has not taken yet. */
  sending?: string | undefined;
  onSendPrompt: (text: string) => void;
};

const noop = () => undefined;
const sentView = { localId: "sending", text: "", state: "sending" as const, error: undefined };
const modifyActions = {
  onAnswerPermission: noop,
  answering: {},
  onRetryMessage: noop,
  onDismissMessage: noop,
};

/** The conversation with the Modify agent: the session stream plus a prompt box. */
export function ModifyChat({ events, canSend, sending, onSendPrompt }: Props) {
  // The relay answers this agent's requests by itself: a card with buttons would only mislead.
  const outgoing = useMemo(
    () => (sending === undefined ? [] : [{ ...sentView, text: sending }]),
    [sending],
  );
  const built = useViewItems(events, outgoing);
  const items = useMemo(
    () => built.filter((item) => item.type !== "permission" || item.answer !== undefined),
    [built],
  );
  return (
    <>
      <Stream items={items} actions={modifyActions} />
      {canSend && sending === undefined && (
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
