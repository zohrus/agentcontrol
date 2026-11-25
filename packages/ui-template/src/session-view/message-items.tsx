import { Markdown } from "./markdown.tsx";
import { usePacedText } from "./use-paced-text.ts";
import type { ItemOf } from "./view-items.ts";

const bubble = "max-w-[78%] self-end whitespace-pre-wrap rounded-[10px] bg-accent-soft px-3 py-2";

export function UserMessage({ item }: { item: ItemOf<"user"> }) {
  return <div className={bubble}>{item.text}</div>;
}

/** The agent's reply; while it is still arriving its text is revealed at a pace and its tail waits. */
export function AgentMessage({ item }: { item: ItemOf<"message"> }) {
  const streaming = item.streaming === true;
  const text = usePacedText({ text: item.text, live: streaming, fresh: item.fresh === true });
  return <Markdown text={text} final={!streaming} />;
}
