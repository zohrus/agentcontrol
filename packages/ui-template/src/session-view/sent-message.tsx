import { Button } from "../components/index.ts";
import type { ItemOf } from "./view-items.ts";

type Props = {
  item: ItemOf<"outgoing">;
  onRetry: (localId: string) => void;
  onDismiss: (localId: string) => void;
};

/** Why a message was not sent, with what can be done about it: send it again, or let it go. */
function NotSent({ item, onRetry, onDismiss }: Props) {
  return (
    <div role="alert" className="flex flex-col items-end gap-1.5 text-[11px] text-fail">
      <span>Not sent: {item.error ?? "the message could not be delivered."}</span>
      <span className="flex gap-1.5">
        <Button
          onClick={() => {
            onRetry(item.localId);
          }}
        >
          Send again
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            onDismiss(item.localId);
          }}
        >
          Remove
        </Button>
      </span>
    </div>
  );
}

/** Beside the bubble, not under it: saying it is on its way never makes the message any taller. */
function Sending() {
  return (
    <span
      role="status"
      className="absolute right-full bottom-0 mr-2 whitespace-nowrap text-[11px] text-muted"
    >
      Sending…
    </span>
  );
}

/**
 * A message the user sent: shown at once, and drawn by this same component (under the same key)
 * when the history holds its own copy, so it keeps its element and its height all the way.
 */
export function SentMessage(props: Props) {
  const { item } = props;
  const failed = item.state === "failed";
  return (
    <div className="flex flex-col gap-1">
      <div className="relative max-w-[78%] self-end">
        <div
          className={`whitespace-pre-wrap rounded-[10px] bg-accent-soft px-3 py-2 ${failed ? "opacity-70" : ""}`}
        >
          {item.text}
        </div>
        {item.state === "sending" && <Sending />}
      </div>
      {failed && <NotSent {...props} />}
    </div>
  );
}
