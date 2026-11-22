import type { ReactNode } from "react";
import type { WorkspaceGroup } from "./group-entries.ts";
import type { SessionListEntry } from "./types.ts";

type Props = {
  group: WorkspaceGroup;
  renderEntry: (entry: SessionListEntry) => ReactNode;
};

export function WorkspaceSection({ group, renderEntry }: Props) {
  return (
    <section className="flex flex-col gap-0.5">
      <h3 className="m-0 flex justify-between px-1.5 py-0.5 font-mono text-[10px] font-normal uppercase tracking-widest text-muted">
        <span>{group.workspace}</span>
        <span>{group.entries.length}</span>
      </h3>
      {group.entries.map(renderEntry)}
    </section>
  );
}
