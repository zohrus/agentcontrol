import { ArrowDown } from "lucide-react";
import { useMemo, useRef } from "react";
import { Button } from "../components/index.ts";
import { type ItemActions, StreamItem } from "./item-renderers.tsx";
import { keepSentMessages, newSentMemory } from "./outgoing-items.ts";
import { SentMessage } from "./sent-message.tsx";
import { Working } from "./status-items.tsx";
import { useFollowBottom } from "./use-follow-bottom.ts";
import type { ViewItem } from "./view-items.ts";

/** A turn is running; `since` is when it began, when known. */
export type TurnRunning = { since: string | undefined };

type Props = {
  items: readonly ViewItem[];
  actions: ItemActions;
  /** Set while a turn runs: the stream ends with a "Working" row, which the end of the turn replaces. */
  working?: TurnRunning | undefined;
};

function Row({ item, actions }: { item: ViewItem; actions: ItemActions }) {
  if (item.type !== "outgoing") return <StreamItem item={item} actions={actions} />;
  return (
    <SentMessage
      item={item}
      onRetry={actions.onRetryMessage}
      onDismiss={actions.onDismissMessage}
    />
  );
}

/** The "Working" row, unless the turn's own end line is already the last thing shown. */
function WorkingRow({ items, working }: Pick<Props, "items" | "working">) {
  if (working === undefined || items.at(-1)?.type === "turn-ended") return null;
  return <Working since={working.since} />;
}

/** Offered while the user is away from the bottom and new content has arrived. */
function JumpToLatest({ onJump }: { onJump: () => void }) {
  return (
    <Button
      variant="primary"
      onClick={onJump}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-md"
    >
      <ArrowDown className="size-3.5" />
      Jump to latest
    </Button>
  );
}

/**
 * The scrolling event stream. It follows new content only while the user is at the bottom; the
 * button that takes them back lies over the stream and takes no room of its own.
 */
export function Stream({ items, actions, working }: Props) {
  const { scroller, content, handlers, behind, jump } = useFollowBottom();
  const memory = useRef(newSentMemory());
  const shown = useMemo(() => keepSentMessages([...items], memory.current), [items]);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        role="log"
        tabIndex={0}
        aria-label="Conversation"
        className="min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]"
        {...handlers}
      >
        <div ref={content} className="flex flex-col gap-2.5 px-4 py-3.5">
          {shown.map((item) => (
            <Row key={item.key} item={item} actions={actions} />
          ))}
          <WorkingRow items={shown} working={working} />
        </div>
      </div>
      {behind && <JumpToLatest onJump={jump} />}
    </div>
  );
}
