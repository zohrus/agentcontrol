import type { SessionEvent, SessionSummary } from "@agentcontrol/protocol";
import { useMemo } from "react";
import { ArchivedBanner } from "../archive/index.ts";
import { agentLabel } from "../session-list/index.ts";
import type { SessionUsage } from "../status/index.ts";
import { Composer } from "./composer.tsx";
import { buildViewItems, isTurnRunning } from "./reduce-events.ts";
import { SessionHeader } from "./session-header.tsx";
import { Stream } from "./stream.tsx";

export type SessionViewProps = {
  summary: SessionSummary;
  events: readonly SessionEvent[];
  /** Tokens and cost so far, shown as a chip in the header. */
  usage?: SessionUsage | undefined;
  /** True while the agent works on a turn (the session row's `turnRunning`); worked out from `events` when left out. */
  turnRunning?: boolean | undefined;
  onSendPrompt: (text: string) => void;
  onCancel: () => void;
  /** Asks to archive; the caller shows the confirmation (see ArchiveDialog). */
  onArchive: () => void;
  onAnswerPermission: (requestId: string, optionId: string) => void;
};

function Footer(props: SessionViewProps) {
  if (props.summary.status === "archived") {
    return <ArchivedBanner archivedAt={props.summary.archivedAt} />;
  }
  return (
    <Composer
      running={props.turnRunning ?? isTurnRunning(props.events)}
      placeholder={`Reply to ${agentLabel(props.summary.agent)}…`}
      onSendPrompt={props.onSendPrompt}
      onCancel={props.onCancel}
      onArchive={props.onArchive}
    />
  );
}

/** Header, event stream and composer for one session; archived sessions are read-only. */
export function SessionView(props: SessionViewProps) {
  const items = useMemo(() => buildViewItems(props.events), [props.events]);
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-surface">
      <SessionHeader summary={props.summary} usage={props.usage} />
      <Stream items={items} actions={{ onAnswerPermission: props.onAnswerPermission }} />
      <Footer {...props} />
    </div>
  );
}
