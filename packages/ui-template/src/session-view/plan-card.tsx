import { Check, Circle, CircleDot } from "lucide-react";
import type { ReactNode } from "react";
import type { ItemOf } from "./view-items.ts";

const icons: Record<string, ReactNode> = {
  completed: <Check className="size-3 text-done" />,
  in_progress: <CircleDot className="size-3 text-run" />,
};

export function PlanCard({ item }: { item: ItemOf<"plan"> }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 rounded-lg border border-dashed border-line p-2 px-2.5 text-xs text-muted">
      {item.entries.map((entry) => (
        <li key={entry.content} className="flex items-center gap-1.5">
          {icons[entry.status] ?? <Circle className="size-3" />}
          <span className={entry.status === "completed" ? "text-done" : undefined}>
            {entry.content}
          </span>
        </li>
      ))}
    </ul>
  );
}
