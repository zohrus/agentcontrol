import { Check, Loader, X } from "lucide-react";
import type { ReactNode } from "react";
import type { DiffStat, ItemOf } from "./view-items.ts";

function Stat({ stat }: { stat: DiffStat }) {
  return (
    <span className="ml-auto font-mono text-[11px]">
      <span className="text-add-fg">+{stat.additions}</span>{" "}
      <span className="text-del-fg">−{stat.deletions}</span>
    </span>
  );
}

const statusIcons: Record<string, ReactNode> = {
  completed: <Check className="size-3.5 text-done" aria-label="completed" />,
  failed: <X className="size-3.5 text-fail" aria-label="failed" />,
};

function Result({ item }: { item: ItemOf<"tool"> }) {
  if (item.stat) return <Stat stat={item.stat} />;
  const icon = statusIcons[item.status] ?? <Loader className="size-3.5 animate-spin" />;
  return <span className="ml-auto text-muted">{icon}</span>;
}

/** One tool call: kind, target, and either its diff stat or its status. */
export function ToolCard({ item }: { item: ItemOf<"tool"> }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs">
      <span className="w-12 flex-none font-mono text-[10px] text-muted">{item.kind}</span>
      <code className="truncate font-mono">{item.path ?? item.title}</code>
      <Result item={item} />
    </div>
  );
}
