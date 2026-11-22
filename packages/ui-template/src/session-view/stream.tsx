import { useEffect, useRef } from "react";
import { type ItemActions, StreamItem } from "./item-renderers.tsx";
import type { ViewItem } from "./view-items.ts";

type Props = { items: readonly ViewItem[]; actions: ItemActions };

/** The scrolling event stream; follows the newest item. */
export function Stream({ items, actions }: Props) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [items]);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3.5">
      {items.map((item) => (
        <StreamItem key={item.key} item={item} actions={actions} />
      ))}
      <div ref={bottom} />
    </div>
  );
}
