import type { ConfigAgent, ScopedItem } from "@agentcontrol/protocol";
import { useState } from "react";
import { Button } from "../components/index.ts";
import { agentName } from "./agents.ts";
import { itemTitle } from "./item-title.ts";
import { kindSpecs } from "./kind-specs.ts";

/** What one agent already has configured. */
export type Found = { agent: ConfigAgent; items: readonly ScopedItem[] };

export type ImportViewProps = {
  found: readonly Found[];
  onAdopt: (items: readonly ScopedItem[]) => void;
  onBack: () => void;
};

const keyOfFound = (agent: string, scoped: ScopedItem): string =>
  `${agent}|${scoped.item.id}|${scoped.scope.repoPath ?? ""}`;

type RowProps = { scoped: ScopedItem; picked: boolean; onToggle: () => void };

function FoundRow({ scoped, picked, onToggle }: RowProps) {
  const { item } = scoped;
  return (
    <li className="flex flex-col gap-0.5">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={picked} onChange={onToggle} />
        <span className="font-medium">{itemTitle(item)}</span>
        <span className="text-[11px] text-muted">{kindSpecs[item.kind].noun}</span>
      </label>
      <span className="truncate pl-6 font-mono text-[11px] text-muted">
        {kindSpecs[item.kind].summary(item)}
      </span>
    </li>
  );
}

type Picking = { picked: ReadonlySet<string>; toggle: (key: string) => void };

function AgentFound({ entry, picking }: { entry: Found; picking: Picking }) {
  return (
    <section aria-label={agentName(entry.agent)} className="flex flex-col gap-2">
      <h3 className="m-0 text-xs font-medium">{agentName(entry.agent)}</h3>
      {entry.items.length === 0 && <p className="m-0 text-xs text-muted">Nothing set up yet.</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {entry.items.map((scoped) => {
          const key = keyOfFound(entry.agent, scoped);
          return (
            <FoundRow
              key={key}
              scoped={scoped}
              picked={picking.picked.has(key)}
              onToggle={() => {
                picking.toggle(key);
              }}
            />
          );
        })}
      </ul>
    </section>
  );
}

function usePicking(found: readonly Found[]): Picking {
  const all = found.flatMap((entry) => entry.items.map((s) => keyOfFound(entry.agent, s)));
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set(all));
  return {
    picked,
    toggle: (key) => {
      const next = new Set(picked);
      if (!next.delete(key)) next.add(key);
      setPicked(next);
    },
  };
}

/** What each agent already has, each item with a tick to adopt it into AgentControl. */
export function ImportView({ found, onAdopt, onBack }: ImportViewProps) {
  const picking = usePicking(found);
  const chosen = found.flatMap((entry) =>
    entry.items.filter((scoped) => picking.picked.has(keyOfFound(entry.agent, scoped))),
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      {found.map((entry) => (
        <AgentFound key={entry.agent} entry={entry} picking={picking} />
      ))}
      <div className="flex justify-end gap-2">
        <Button onClick={onBack}>Cancel</Button>
        <Button
          variant="primary"
          disabled={chosen.length === 0}
          onClick={() => {
            onAdopt(chosen);
          }}
        >
          Adopt {chosen.length} selected
        </Button>
      </div>
    </div>
  );
}
