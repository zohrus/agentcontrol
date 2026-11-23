import { Markdown } from "./markdown.tsx";
import type { ItemOf } from "./view-items.ts";

export function UserMessage({ item }: { item: ItemOf<"user"> }) {
  return (
    <div className="max-w-[78%] self-end whitespace-pre-wrap rounded-[10px] bg-accent-soft px-3 py-2">
      {item.text}
    </div>
  );
}

export function AgentMessage({ item }: { item: ItemOf<"message"> }) {
  return <Markdown text={item.text} />;
}

export function Thought({ item }: { item: ItemOf<"thought"> }) {
  return (
    <div className="whitespace-pre-wrap border-l-2 border-line pl-2.5 text-xs text-muted">
      <span className="font-medium">Thinking · </span>
      {item.text}
    </div>
  );
}
