import { Button } from "../components/index.ts";

/** A message waiting for the agent, as the list above the message box shows it. */
export type QueuedView = { id: string; text: string };

/** The queue above the message box: what it holds, and what the buttons on a row do. */
export type QueueProps = {
  messages: readonly QueuedView[];
  /** The queue is held back after Cancel: nothing is sent until the user says so. */
  paused: boolean;
  onQueue: (text: string) => void;
  onRemove: (id: string) => void;
  /** Lets a held queue go on: its first message is sent now. */
  onSendNow: () => void;
};

type RowProps = {
  message: QueuedView;
  /** Offer "Send now" on this row. */
  canSendNow: boolean;
  onEdit: (message: QueuedView) => void;
  onRemove: (id: string) => void;
  onSendNow: () => void;
};

function RowButton(props: { label: string; onPress: () => void }) {
  return (
    <Button variant="ghost" className="px-1.5 py-0" onClick={props.onPress}>
      {props.label}
    </Button>
  );
}

function Row({ message, canSendNow, onEdit, onRemove, onSendNow }: RowProps) {
  return (
    <li className="flex items-center gap-1 text-[11px]">
      <span className="min-w-0 flex-1 truncate text-fg" title={message.text}>
        {message.text}
      </span>
      {canSendNow && <RowButton label="Send now" onPress={onSendNow} />}
      <RowButton
        label="Edit"
        onPress={() => {
          onEdit(message);
        }}
      />
      <RowButton
        label="Remove"
        onPress={() => {
          onRemove(message.id);
        }}
      />
    </li>
  );
}

const WHEN_SENT = {
  running: "Queued: each message is sent when the agent has finished the one before.",
  paused: "Queued, held after Cancel: press Send now, or send a new message, to go on.",
} as const;

/**
 * The queued messages, oldest first, with their buttons. The list is capped in height and scrolls
 * inside, so a long queue never pushes the conversation away.
 */
export function QueueList(props: QueueProps & { onEdit: (message: QueuedView) => void }) {
  const { messages, paused, onEdit, onRemove, onSendNow } = props;
  if (messages.length === 0) return null;
  return (
    <section aria-label="Queued messages" className="flex flex-col gap-1">
      <p role="status" className="m-0 text-[11px] text-muted">
        {paused ? WHEN_SENT.paused : WHEN_SENT.running}
      </p>
      <ul className="m-0 flex max-h-24 list-none flex-col gap-0.5 overflow-y-auto p-0">
        {messages.map((message, index) => (
          <Row
            key={message.id}
            message={message}
            canSendNow={paused && index === 0}
            onEdit={onEdit}
            onRemove={onRemove}
            onSendNow={onSendNow}
          />
        ))}
      </ul>
    </section>
  );
}
