import type { SessionSummary } from "@agentcontrol/protocol";
import { Archive, Check, Copy, Info } from "lucide-react";
import { type FocusEvent, type ReactNode, useId, useRef, useState } from "react";
import { Button } from "../components/index.ts";
import { agentLabel, StatusDot } from "../session-list/index.ts";
import { ElapsedTime, type SessionUsage, usageBreakdown, usageHeadline } from "../status/index.ts";
import { useDismiss } from "./use-dismiss.ts";

export type DetailsProps = {
  summary: SessionSummary;
  usage?: SessionUsage | undefined;
  /** Omit when the session cannot be archived from here. */
  onArchive?: (() => void) | undefined;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 min-w-0 wrap-anywhere">{children}</dd>
    </>
  );
}

function StatusRow({ summary }: { summary: SessionSummary }) {
  const { status, createdAt, archivedAt } = summary;
  return (
    <Row label="Status">
      <span className="flex items-center gap-1.5">
        <StatusDot status={status} />
        <span>
          {status}, {archivedAt === undefined ? "started" : "ran for"}{" "}
          <ElapsedTime since={createdAt} until={archivedAt} />
          {archivedAt === undefined && " ago"}
        </span>
      </span>
    </Row>
  );
}

function UsageRow({ usage }: { usage?: SessionUsage | undefined }) {
  if (usage === undefined) return <Row label="Usage">None reported yet</Row>;
  return (
    <Row label="Usage">
      {usageHeadline(usage)}
      <div className="text-muted">{usageBreakdown(usage)}</div>
    </Row>
  );
}

/** Where the session runs and what it has used. */
function Facts({ summary, usage }: Pick<DetailsProps, "summary" | "usage">) {
  const agent = agentLabel(summary.agent);
  return (
    <dl className="m-0 grid grid-cols-[5.25rem_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 px-2 py-1.5">
      <StatusRow summary={summary} />
      <Row label="Agent">{usage?.model === undefined ? agent : `${agent} · ${usage.model}`}</Row>
      <Row label="Repository">
        <span className="font-mono text-[11.5px]">{summary.repoPath}</span>
      </Row>
      <Row label="Branch">
        <span className="font-mono text-[11.5px]">{summary.branch}</span>
        {summary.baseBranch !== "" && (
          <span className="text-muted"> from {summary.baseBranch}</span>
        )}
      </Row>
      <UsageRow usage={usage} />
    </dl>
  );
}

const itemClass = "h-7 w-full justify-start gap-2.5 px-2 font-normal";

function Actions(props: Pick<DetailsProps, "summary" | "onArchive">) {
  const [copied, setCopied] = useState(false);
  const copy = (): void => {
    void navigator.clipboard.writeText(props.summary.branch).then(
      () => {
        setCopied(true);
      },
      () => undefined,
    );
  };
  return (
    <div className="mt-1 flex flex-col border-t border-line pt-1">
      <Button variant="ghost" className={itemClass} onClick={copy}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy branch name"}
      </Button>
      {props.onArchive && (
        <Button variant="ghost" className={itemClass} onClick={props.onArchive}>
          <Archive className="size-3.5" />
          Archive session…
        </Button>
      )}
    </div>
  );
}

function Panel(props: DetailsProps & { id: string; onClose: () => void }) {
  const { onArchive, onClose } = props;
  const archive =
    onArchive &&
    (() => {
      onClose();
      onArchive();
    });
  return (
    <div
      id={props.id}
      role="dialog"
      aria-label="Session details"
      className="absolute right-2.5 top-full z-30 mt-1 w-82 max-w-[calc(100%-1rem)] rounded-[10px] bg-surface p-1.5 text-xs leading-[17px] shadow-lg ring-1 ring-line"
    >
      <Facts summary={props.summary} usage={props.usage} />
      <Actions summary={props.summary} onArchive={archive} />
    </div>
  );
}

/** Open or closed; closed by Escape (focus goes back to the button), a press outside, or the focus leaving. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const close = (): void => {
    setOpen(false);
  };
  const onEscape = (): void => {
    close();
    wrapper.current?.querySelector("button")?.focus();
  };
  useDismiss({ open, inside: wrapper, onEscape, onOutsidePress: close });
  const onBlur = (event: FocusEvent<HTMLElement>): void => {
    const { relatedTarget } = event;
    if (relatedTarget instanceof Node && !event.currentTarget.contains(relatedTarget)) close();
  };
  const toggle = (): void => {
    setOpen((now) => !now);
  };
  return { open, wrapper, close, toggle, onBlur };
}

/** The ⓘ button of the header and the panel it opens: what the header has no room for, and Archive. */
export function SessionDetails(props: DetailsProps) {
  const popover = usePopover();
  const panelId = useId();
  return (
    <div ref={popover.wrapper} onBlur={popover.onBlur}>
      <Button
        variant="ghost"
        title="Details"
        aria-label="Details"
        aria-haspopup="dialog"
        aria-expanded={popover.open}
        aria-controls={popover.open ? panelId : undefined}
        className="size-7 p-0"
        onClick={popover.toggle}
      >
        <Info aria-hidden="true" className="size-4" />
      </Button>
      {popover.open && <Panel {...props} id={panelId} onClose={popover.close} />}
    </div>
  );
}
