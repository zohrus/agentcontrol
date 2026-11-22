import type { SessionEvent } from "@agentcontrol/protocol";
import { useMemo } from "react";
import { buildViewItems, Composer, isTurnRunning, Stream } from "../session-view/index.ts";

type Props = {
  events: readonly SessionEvent[];
  onSendPrompt: (text: string) => void;
};

const modifyActions = { onAnswerPermission: () => undefined };
const noop = () => undefined;

/** The conversation with the Modify agent: the session stream plus a prompt box. */
export function ModifyChat({ events, onSendPrompt }: Props) {
  const items = useMemo(() => buildViewItems(events), [events]);
  return (
    <>
      <Stream items={items} actions={modifyActions} />
      <Composer
        running={isTurnRunning(events)}
        placeholder="Describe a change to this UI…"
        onSendPrompt={onSendPrompt}
        onCancel={noop}
      />
    </>
  );
}
