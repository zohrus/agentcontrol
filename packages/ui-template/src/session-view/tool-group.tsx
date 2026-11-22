import { ChevronRight } from "lucide-react";
import { groupLabel } from "./group-tools.ts";
import { ToolCard } from "./tool-card.tsx";
import type { ItemOf } from "./view-items.ts";

/** A run of read/search calls as one line; opens to list each call. */
export function ToolGroup({ item }: { item: ItemOf<"tool-group"> }) {
  return (
    <details className="group rounded-lg border border-line text-xs">
      <summary className="flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-muted">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
        {groupLabel(item.tools)}
      </summary>
      <div className="flex flex-col gap-1.5 border-t border-line p-2">
        {item.tools.map((tool) => (
          <ToolCard key={tool.key} item={tool} />
        ))}
      </div>
    </details>
  );
}
