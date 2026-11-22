import type { SessionEvent, SessionSummary } from "@agentcontrol/protocol";
import { useMemo } from "react";
import { agentLabel } from "../session-list/index.ts";
import { Composer } from "./composer.tsx";
import { SessionHeader } from "./session-header.tsx";
import { buildViewItems, isTurnRunning } from "./reduce-events.ts";
import { Stream } from "./stream.tsx";

export type SessionViewProps = {
  summary: SessionSummary;
  events: readonly SessionEvent[];
  onSendPrompt: (text: string) => void;
  onCancel: () => void;
  onArchive: () => void;
  onAnswerPermission: (requestId: string, optionId: string) => void;
};

/** Header, event stream and composer for one session. */
export function SessionView(props: SessionViewProps) {
  const items = useMemo(() => buildViewItems(props.events), [props.events]);
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-surface">
      <SessionHeader summary={props.summary} />
      <Stream items={items} actions={{ onAnswerPermission: props.onAnswerPermission }} />
      <Composer
        running={isTurnRunning(props.events)}
        placeholder={`Reply to ${agentLabel(props.summary.agent)}…`}
        onSendPrompt={props.onSendPrompt}
        onCancel={props.onCancel}
        onArchive={props.onArchive}
      />
    </div>
  );
}
