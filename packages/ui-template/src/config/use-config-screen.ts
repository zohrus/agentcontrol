import type { ConfigAgent, ScopedItem } from "@agentcontrol/protocol";
import { useEffect, useState } from "react";
import { agentOfPath, allAgents } from "./agents.ts";
import { newOnes, placeOf, repoOf, withItem } from "./config-items.ts";
import type { DriftEntry } from "./drift-banner.tsx";
import type { Kind } from "./kind-spec.ts";
import type { ConfigActions } from "./types.ts";

export type View = "items" | "review" | "import";

type Editing = { kind: Kind; initial?: ScopedItem | undefined };

type Call = {
  items: readonly ScopedItem[];
  actions: ConfigActions;
  goTo: (view: View) => void;
  say: (notice: string | undefined) => void;
};

/** Which tab is open, and adding, editing, deleting and switching on or off the items in it. */
function useItemEdits({ items, actions, say }: Call) {
  const [kind, setKind] = useState<Kind>("mcp");
  const [editing, edit] = useState<Editing>();
  const save = async (next: readonly ScopedItem[]) => {
    say(undefined);
    await actions.save(next);
  };
  return {
    kind,
    setKind,
    editing,
    edit,
    saveEdited: async (scoped: ScopedItem) => {
      edit(undefined);
      await save(withItem({ items, scoped, replaces: editing?.initial }));
    },
    remove: (gone: ScopedItem) => save(items.filter((held) => placeOf(held) !== placeOf(gone))),
    toggle: (one: ScopedItem) =>
      save(withItem({ items, scoped: { ...one, enabled: !one.enabled } })),
  };
}

/** Review changes, Undo and Done, and which agents the review is for. */
function useReviewFlow({ items, actions, goTo, say }: Call) {
  const [agents, setAgents] = useState<readonly ConfigAgent[]>(allAgents);
  const review = async (chosen: readonly ConfigAgent[] = agents) => {
    const repoPath = repoOf(items);
    const target = { agents: [...chosen], ...(repoPath && { repoPath }) };
    if (await actions.review(target)) goTo("review");
  };
  return {
    agents,
    setAgents,
    review,
    keepEdit: async (entry: DriftEntry) => {
      const agent = agentOfPath(entry.path);
      if (await actions.keepManualEdit({ agent, itemIds: entry.itemIds })) await review();
    },
    undo: async (force: boolean) => {
      if (!(await actions.undo(force))) return;
      goTo("items");
      say("Undone: the files are back as they were before the apply.");
    },
    done: () => {
      actions.forgetReview();
      goTo("items");
    },
  };
}

/** Import existing setup: find what the agents have, then adopt the items the user picked. */
function useImport({ items, actions, goTo, say }: Call) {
  return {
    importExisting: async () => {
      if (await actions.findExisting(allAgents)) goTo("import");
    },
    adopt: async (found: readonly ScopedItem[]) => {
      const fresh = newOnes(items, found);
      if (!(await actions.save([...items, ...fresh]))) return;
      actions.forgetFound();
      goTo("items");
      say(`Adopted ${String(fresh.length)} item(s). Review changes to record them.`);
    },
  };
}

/** What the user has open on the Config screen and what each of its buttons does. */
export function useConfigScreen(call: {
  open: boolean;
  items: readonly ScopedItem[];
  actions: ConfigActions;
}) {
  const { open, items, actions } = call;
  const [view, goTo] = useState<View>("items");
  const [notice, say] = useState<string>();
  useEffect(() => {
    if (!open) return;
    goTo("items");
    say(undefined);
    void actions.load();
  }, [open, actions]);
  const shared = { items, actions, goTo, say };
  return {
    view,
    notice,
    goTo,
    ...useItemEdits(shared),
    ...useReviewFlow(shared),
    ...useImport(shared),
  };
}
