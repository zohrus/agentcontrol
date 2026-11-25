import type { SessionEvent, SessionSummary } from "@agentcontrol/protocol";
import { ArchivedBanner } from "../archive/index.ts";
import { agentLabel } from "../session-list/index.ts";
import type { SessionUsage } from "../status/index.ts";
import { Composer } from "./composer.tsx";
import { InterruptedBanner } from "./interrupted-banner.tsx";
import { ReadOnlyBanner } from "./read-only-banner.tsx";
import { isTurnRunning } from "./reduce-events.ts";
import { SessionHeader } from "./session-header.tsx";
import { Stream } from "./stream.tsx";
import type { OutgoingView } from "./outgoing-items.ts";
import { useViewItems } from "./use-view-items.ts";

/** The actions of a session that are in flight. */
type InFlight = { cancelling?: boolean; archiving?: boolean; resuming?: boolean };

export type SessionViewProps = {
  summary: SessionSummary;
  events: readonly SessionEvent[];
  /** Tokens and cost so far, shown as a chip in the header. */
  usage?: SessionUsage | undefined;
  /** True while the agent works on a turn (the session row's `turnRunning`); worked out from `events` when left out. */
  turnRunning?: boolean | undefined;
  onSendPrompt: (text: string) => void;
  /** Messages sent that the history does not hold yet: shown at the end of the conversation. */
  outgoing?: readonly OutgoingView[] | undefined;
  onRetryMessage?: ((localId: string) => void) | undefined;
  onDismissMessage?: ((localId: string) => void) | undefined;
  /** What the user started that the app has not answered yet: the buttons say so and wait. */
  inFlight?: InFlight | undefined;
  /** Permission requests whose answer is on its way: request id to the option chosen. */
  answering?: Readonly<Record<string, string>> | undefined;
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

/** What the composer says about the session: running or starting, and what is in flight. */
function composerStateOf(props: SessionViewProps) {
  const { summary, inFlight } = props;
  return {
    running: props.turnRunning ?? isTurnRunning(props.events),
    placeholder: placeholderOf(summary),
    starting: summary.status === "starting",
    notReady: notReadyOf(summary),
    cancelling: inFlight?.cancelling === true,
    archiving: inFlight?.archiving === true,
  };
}

/** Offers to start a new agent when the relay stopped with the old one; says so while it starts. */
function ResumeOffer(props: SessionViewProps) {
  if (props.summary.status !== "interrupted") return null;
  return (
    <InterruptedBanner onResume={props.onResume} resuming={props.inFlight?.resuming === true} />
  );
}

function Footer(props: SessionViewProps) {
  if (props.summary.status === "archived") {
    return <ArchivedBanner archivedAt={props.summary.archivedAt} />;
  }
  if (props.readOnlyNote !== undefined) return <ReadOnlyBanner text={props.readOnlyNote} />;
  return (
    <>
      <ResumeOffer {...props} />
      <Composer
        key={props.summary.id}
        {...composerStateOf(props)}
        onSendPrompt={props.onSendPrompt}
        onCancel={props.onCancel}
        onArchive={props.onArchive}
      />
    </>
  );
}

const nothing = (): void => undefined;
const noOutgoing: readonly OutgoingView[] = [];
const noAnswers = {};

/** Header, event stream and composer for one session; archived sessions are read-only. */
export function SessionView(props: SessionViewProps) {
  const { outgoing = noOutgoing } = props;
  const items = useViewItems(props.events, outgoing);
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-surface">
      <SessionHeader summary={props.summary} usage={props.usage} />
      <Stream
        items={items}
        actions={{
          onAnswerPermission: props.onAnswerPermission,
          answering: props.answering ?? noAnswers,
          onRetryMessage: props.onRetryMessage ?? nothing,
          onDismissMessage: props.onDismissMessage ?? nothing,
        }}
      />
      <Footer {...props} />
    </div>
  );
}
