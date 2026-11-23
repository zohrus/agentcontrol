import type { ReactNode } from "react";
import { cn } from "../components/index.ts";
import type { WorkspaceGroup } from "./group-entries.ts";
import type { SessionListEntry } from "./types.ts";

type Props = {
  group: WorkspaceGroup;
  renderEntry: (entry: SessionListEntry) => ReactNode;
};

/** One workspace's sessions under its name, its connection and, when it is down, why. */
export function WorkspaceSection({ group, renderEntry }: Props) {
  return (
    <section aria-label={group.title} className="flex flex-col gap-0.5">
      <h3 className="m-0 flex items-baseline gap-1.5 px-1.5 py-0.5 font-mono text-[10px] font-normal uppercase tracking-widest text-muted">
        <span>{group.title}</span>
        {group.status !== "" && (
          <span className={cn("normal-case tracking-normal", group.detail && "text-wait")}>
            {group.status}
          </span>
        )}
        <span className="ml-auto">{group.entries.length}</span>
      </h3>
      {group.detail && <p className="m-0 px-1.5 pb-1 text-[11px] text-muted">{group.detail}</p>}
      {group.entries.map(renderEntry)}
    </section>
  );
}
