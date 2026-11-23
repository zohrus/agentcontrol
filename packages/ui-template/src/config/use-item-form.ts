import type { ConfigItem, ScopedItem } from "@agentcontrol/protocol";
import { type SyntheticEvent, useState } from "react";
import type { Form, Kind } from "./kind-spec.ts";
import { kindSpecs, newId } from "./kind-specs.ts";

/** The scope choice of "All repositories". */
export const GLOBAL = "";

export type ItemFormCall = {
  kind: Kind;
  /** The item being edited; a new one when left out. */
  initial: ScopedItem | undefined;
  /** Ids of the items that exist, so a new one gets its own. */
  takenIds: ReadonlySet<string>;
  onSave: (item: ScopedItem) => void;
};

const scopeOf = (initial: ScopedItem | undefined): string => initial?.scope.repoPath ?? GLOBAL;

const placeOf = (repoPath: string): ScopedItem["scope"] =>
  repoPath === GLOBAL ? { scope: "global" } : { scope: "repo", repoPath };

/** The item the form made, with its id, where it applies and whether it is on. */
function scopedFrom(item: ConfigItem, how: { scope: string; call: ItemFormCall }): ScopedItem {
  const id = item.id || newId(item, how.call.takenIds);
  return {
    item: { ...item, id },
    scope: placeOf(how.scope),
    enabled: how.call.initial?.enabled ?? true,
  };
}

/** The values typed into an item's form, the repository it applies to, and what Save does. */
export function useItemForm(call: ItemFormCall) {
  const spec = kindSpecs[call.kind];
  const [form, setForm] = useState<Form>(() => spec.toForm(call.initial?.item));
  const [scope, setScope] = useState(scopeOf(call.initial));
  const [error, setError] = useState<string>();
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const built = spec.build(form, call.initial?.item);
    if ("error" in built) {
      setError(built.error);
      return;
    }
    call.onSave(scopedFrom(built.item, { scope, call }));
  };
  return {
    spec,
    form,
    scope,
    error,
    setScope,
    submit,
    set: (key: string, value: string) => {
      setForm({ ...form, [key]: value });
    },
  };
}
