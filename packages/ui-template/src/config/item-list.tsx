import type { ScopedItem, UnsupportedItem } from "@agentcontrol/protocol";
import { Plus } from "lucide-react";
import { Button } from "../components/index.ts";
import { agentName } from "./agents.ts";
import { itemTitle } from "./item-title.ts";
import type { Kind } from "./kind-spec.ts";
import { kindSpecs } from "./kind-specs.ts";

export type ItemListProps = {
  kind: Kind;
  items: readonly ScopedItem[];
  /** What the last review said the agents cannot take, to explain next to each item. */
  unsupported: readonly UnsupportedItem[];
  onAdd: () => void;
  onEdit: (item: ScopedItem) => void;
  onDelete: (item: ScopedItem) => void;
  onToggle: (item: ScopedItem) => void;
};

type RowProps = Omit<ItemListProps, "kind" | "items" | "onAdd"> & { scoped: ScopedItem };

function Notes({ notes }: { notes: readonly UnsupportedItem[] }) {
  return notes.map((note) => (
    <p key={note.agent} className="m-0 text-[11px] text-wait">
      {agentName(note.agent)} will not get this: {note.reason}
    </p>
  ));
}

function RowButtons({
  scoped,
  onEdit,
  onDelete,
}: Pick<RowProps, "scoped" | "onEdit" | "onDelete">) {
  return (
    <div className="flex gap-1.5">
      <Button
        onClick={() => {
          onEdit(scoped);
        }}
      >
        Edit
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          onDelete(scoped);
        }}
      >
        Delete
      </Button>
    </div>
  );
}

function RowTitle({ scoped, onToggle }: Pick<RowProps, "scoped" | "onToggle">) {
  const where = scoped.scope.repoPath ? `Only in ${scoped.scope.repoPath}` : "All repositories";
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          checked={scoped.enabled}
          onChange={() => {
            onToggle(scoped);
          }}
        />
        {itemTitle(scoped.item)}
      </label>
      <span className="ml-auto truncate font-mono text-[11px] text-muted">{where}</span>
    </div>
  );
}

function Row({ scoped, unsupported, ...actions }: RowProps) {
  const { item } = scoped;
  return (
    <li
      aria-label={itemTitle(item)}
      className="flex flex-col gap-1 rounded-lg border border-line p-3"
    >
      <RowTitle scoped={scoped} onToggle={actions.onToggle} />
      <span className="truncate font-mono text-[11px] text-muted">
        {kindSpecs[item.kind].summary(item)}
      </span>
      <Notes notes={unsupported.filter((note) => note.itemId === item.id)} />
      <RowButtons scoped={scoped} onEdit={actions.onEdit} onDelete={actions.onDelete} />
    </li>
  );
}

/** The items of one kind: switch each on or off, edit or delete it, or add another. */
export function ItemList({ kind, items, onAdd, ...rest }: ItemListProps) {
  const spec = kindSpecs[kind];
  return (
    <div className="flex flex-col gap-2 p-4">
      {items.length === 0 && <p className="m-0 text-muted">No {spec.label.toLowerCase()} yet.</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((scoped) => (
          <Row key={`${scoped.item.id}/${scoped.scope.repoPath ?? ""}`} scoped={scoped} {...rest} />
        ))}
      </ul>
      <Button className="self-start" onClick={onAdd}>
        <Plus className="size-3.5" /> Add {spec.noun}
      </Button>
    </div>
  );
}
