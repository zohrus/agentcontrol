import { Button } from "../components/index.ts";
import { Markdown } from "./markdown.tsx";
import { usePacedText } from "./use-paced-text.ts";
import type { ItemOf } from "./view-items.ts";

const bubble = "max-w-[78%] self-end whitespace-pre-wrap rounded-[10px] bg-accent-soft px-3 py-2";

export function UserMessage({ item }: { item: ItemOf<"user"> }) {
  return <div className={bubble}>{item.text}</div>;
}

type OutgoingProps = {
  item: ItemOf<"outgoing">;
  onRetry: (localId: string) => void;
  onDismiss: (localId: string) => void;
};

/** Why a message was not sent, with what can be done about it: send it again, or let it go. */
function NotSent({ item, onRetry, onDismiss }: OutgoingProps) {
  const again = () => {
    onRetry(item.localId);
  };
  const remove = () => {
    onDismiss(item.localId);
  };
  return (
    <div role="alert" className="flex flex-col items-end gap-1.5 text-[11px] text-fail">
      <span>Not sent: {item.error ?? "the message could not be delivered."}</span>
      <span className="flex gap-1.5">
        <Button onClick={again}>Send again</Button>
        <Button variant="ghost" onClick={remove}>
          Remove
        </Button>
      </span>
    </div>
  );
}

/** What sits under a message that is not in the history yet: that it is on its way, or why it was not sent. */
function Delivery(props: OutgoingProps) {
  if (props.item.state === "sent") return null;
  if (props.item.state === "failed") return <NotSent {...props} />;
  return (
    <span role="status" className="self-end text-[11px] text-muted">
      Sending…
    </span>
  );
}

/** A message the user just sent: in the conversation at once, then replaced by the history's own copy. */
export function OutgoingMessage(props: OutgoingProps) {
  const { item } = props;
  return (
    <div className="flex flex-col gap-1">
      <div className={`${bubble} ${item.state === "failed" ? "opacity-70" : ""}`}>{item.text}</div>
      <Delivery {...props} />
    </div>
  );
}

/** The agent's reply; while it is still arriving its text is revealed at a pace and its tail waits. */
export function AgentMessage({ item }: { item: ItemOf<"message"> }) {
  const streaming = item.streaming === true;
  const text = usePacedText({ text: item.text, live: streaming, fresh: item.fresh === true });
  return <Markdown text={text} final={!streaming} />;
}
