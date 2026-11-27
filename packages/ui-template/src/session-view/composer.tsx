import { type KeyboardEvent, useRef } from "react";
import { Button } from "../components/index.ts";
import { QueueList, type QueuedView, type QueueProps } from "./queue-list.tsx";
import { useMessage } from "./use-message.ts";

export type ComposerProps = {
  running: boolean;
  /** Cancel was pressed and the app has not answered yet. */
  cancelling?: boolean;
  /** Archive was confirmed and the app has not answered yet. */
  archiving?: boolean;
  placeholder: string;
  onSendPrompt: (text: string) => void;
  /** A message was just sent and the history does not hold it yet: the next one waits in the queue. */
  sending?: boolean;
  /** The session is still being set up: a message waits in the queue until it is ready. */
  starting?: boolean;
  /** The session did not become ready: queued messages are not sent, and stay in the queue. */
  notReady?: boolean;
  /** Omit to send every message at once (for example in the Modify chat, which is never busy here). */
  queue?: QueueProps | undefined;
  onCancel: () => void;
  /** Omit to hide the Archive button (for example in the Modify chat). */
  onArchive?: () => void;
};

type PromptProps = {
  text: string;
  placeholder: string;
  onChange: (text: string) => void;
  onSend: () => void;
};

/** Shift+Enter, Cmd+Enter or Ctrl+Enter sends; Enter alone is a new line. */
function isSendShortcut(event: KeyboardEvent): boolean {
  const withModifier = event.shiftKey || event.metaKey || event.ctrlKey;
  return event.key === "Enter" && withModifier && !event.nativeEvent.isComposing;
}

function Prompt({ text, placeholder, onChange, onSend }: PromptProps) {
  return (
    <textarea
      value={text}
      rows={2}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      onKeyDown={(e) => {
        if (!isSendShortcut(e)) return;
        e.preventDefault();
        onSend();
      }}
      className="resize-none rounded-lg border border-line bg-surface px-3 py-2 text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
    />
  );
}

function NotSent({ notReady, queued }: { notReady: boolean; queued: number }) {
  if (!notReady || queued === 0) return null;
  return (
    <p role="alert" className="m-0 text-[11px] text-fail">
      Not sent: the session did not become ready. Your messages are still queued.
    </p>
  );
}

type ButtonsProps = {
  canSend: boolean;
  running: boolean;
  cancelling: boolean;
  archiving: boolean;
  onSend: () => void;
  onCancel: () => void;
  onArchive?: (() => void) | undefined;
};

/** Cancel while a turn runs; once pressed it says it is cancelling until the app has answered. */
function CancelButton(props: Pick<ButtonsProps, "running" | "cancelling" | "onCancel">) {
  if (!props.running) return null;
  return (
    <Button onClick={props.onCancel} disabled={props.cancelling}>
      {props.cancelling ? "Cancelling…" : "Cancel"}
    </Button>
  );
}

function ArchiveButton({ archiving, onArchive }: Pick<ButtonsProps, "archiving" | "onArchive">) {
  if (!onArchive) return null;
  return (
    <Button className="ml-auto" variant="ghost" onClick={onArchive} disabled={archiving}>
      {archiving ? "Archiving…" : "Archive"}
    </Button>
  );
}

function Buttons(props: ButtonsProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant="primary"
        title="Send (Shift+Enter or Cmd/Ctrl+Enter)"
        onClick={props.onSend}
        disabled={!props.canSend}
      >
        Send
      </Button>
      <CancelButton {...props} />
      <ArchiveButton {...props} />
    </div>
  );
}

type QueueAreaProps = {
  queue: QueueProps | undefined;
  notReady: boolean;
  starting: boolean;
  onEdit: (message: QueuedView) => void;
};

/** The queued messages and, when the session never became ready, why they are not sent. */
function QueueArea({ queue, notReady, starting, onEdit }: QueueAreaProps) {
  if (queue === undefined) return null;
  return (
    <>
      <QueueList {...queue} onEdit={onEdit} />
      <NotSent notReady={notReady && !starting} queued={queue.messages.length} />
    </>
  );
}

/** The queue above the message box, the box, and Send, Cancel (while a turn runs) and Archive. */
export function Composer(props: ComposerProps) {
  const { queue, notReady = false, starting = false } = props;
  const { text, setText, send, edit } = useMessage({
    busy: props.running || starting || props.sending === true,
    queue,
    onSendPrompt: props.onSendPrompt,
  });
  const box = useRef<HTMLDivElement>(null);
  const takeBack = (message: QueuedView) => {
    edit(message);
    box.current?.querySelector("textarea")?.focus();
  };
  return (
    <div ref={box} className="flex flex-col gap-2 border-t border-line px-4 py-2.5">
      <QueueArea queue={queue} notReady={notReady} starting={starting} onEdit={takeBack} />
      <Prompt text={text} placeholder={props.placeholder} onChange={setText} onSend={send} />
      <Buttons
        {...props}
        cancelling={props.cancelling === true}
        archiving={props.archiving === true}
        canSend={text.trim() !== ""}
        onSend={send}
      />
    </div>
  );
}
