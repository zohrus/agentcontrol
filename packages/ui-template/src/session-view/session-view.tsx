import type { SessionEvent, SessionSummary } from "@agentcontrol/protocol";
import { useMemo } from "react";
import { ArchivedBanner } from "../archive/index.ts";
import { agentLabel } from "../session-list/index.ts";
import type { SessionUsage } from "../status/index.ts";
import { Composer } from "./composer.tsx";
import { InterruptedBanner } from "./interrupted-banner.tsx";
import { ReadOnlyBanner } from "./read-only-banner.tsx";
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
  /** Starts a new agent for an interrupted session (its status is "interrupted"). */
  onResume: () => void;
  /** Asks to archive; the caller shows the confirmation (see ArchiveDialog). */
  onArchive: () => void;
  onAnswerPermission: (requestId: string, optionId: string) => void;
  /** Set when the session's workspace cannot take commands: says why, and replaces the composer. */
  readOnlyNote?: string | undefined;
};

function placeholderOf(summary: SessionSummary): string {
  const agent = agentLabel(summary.agent);
  return summary.status === "ready" || summary.status === "starting"
    ? `What should ${agent} do?`
    : `Reply to ${agent}…`;
}

const TAKES_A_PROMPT = new Set(["ready", "running", "idle", "waiting"]);

/** A message held while the session started cannot be sent: setup failed, or the agent is gone. */
const notReadyOf = ({ status, waitingReason }: SessionSummary): boolean =>
  waitingReason === "setup-failed" || !TAKES_A_PROMPT.has(status);

function Footer(props: SessionViewProps) {
  if (props.summary.status === "archived") {
    return <ArchivedBanner archivedAt={props.summary.archivedAt} />;
  }
  if (props.readOnlyNote !== undefined) return <ReadOnlyBanner text={props.readOnlyNote} />;
  return (
    <>
      {props.summary.status === "interrupted" && <InterruptedBanner onResume={props.onResume} />}
      <Composer
        key={props.summary.id}
        running={props.turnRunning ?? isTurnRunning(props.events)}
        placeholder={placeholderOf(props.summary)}
        starting={props.summary.status === "starting"}
        notReady={notReadyOf(props.summary)}
        onSendPrompt={props.onSendPrompt}
        onCancel={props.onCancel}
        onArchive={props.onArchive}
      />
    </>
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
