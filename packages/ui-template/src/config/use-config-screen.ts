import type { ConfigAgent, ScopedItem } from "@agentcontrol/protocol";
import { countOf } from "../status/index.ts";
import { useEffect, useState } from "react";
import { agentOfPath, allAgents } from "./agents.ts";
import { newOnes, toggled, withItem, without } from "./config-items.ts";
import type { DriftEntry } from "./drift-banner.tsx";
import type { Kind } from "./kind-spec.ts";
import { reposOf } from "./review-scopes.ts";
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
function useItemEdits({ actions, say }: Call) {
  const [kind, setKind] = useState<Kind>("mcp");
  const [editing, edit] = useState<Editing>();
  const change = (next: (items: readonly ScopedItem[]) => readonly ScopedItem[]) => {
    say(undefined);
    return actions.change(next);
  };
  return {
    kind,
    setKind,
    editing,
    edit,
    saveEdited: async (scoped: ScopedItem) => {
      const replaces = editing?.initial;
      // The form stays open until the app has stored the item, so a failure loses nothing typed.
      if (await change((items) => withItem({ items, scoped, replaces }))) edit(undefined);
    },
    remove: (gone: ScopedItem) => change((items) => without(items, gone)),
    toggle: (one: ScopedItem) => change((items) => toggled(items, one)),
  };
}

/** Review changes, Undo and Done, and which agents the review is for. */
function useReviewFlow({ items, actions, goTo, say }: Call) {
  const [agents, setAgents] = useState<readonly ConfigAgent[]>(allAgents);
  const review = async () => {
    const chosen = agents.length > 0 ? agents : allAgents;
    setAgents(chosen);
    // One review covers the global files and every repository that has items.
    const target = { agents: [...chosen], repoPaths: reposOf(items) };
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
function useImport({ actions, goTo, say }: Call) {
  return {
    importExisting: async () => {
      if (await actions.findExisting(allAgents)) goTo("import");
    },
    adopt: async (found: readonly ScopedItem[]) => {
      let adopted = 0;
      const saved = await actions.change((held) => {
        const fresh = newOnes(held, found);
        adopted = fresh.length;
        return [...held, ...fresh];
      });
      if (!saved) return;
      actions.forgetFound();
      goTo("items");
      say(`Adopted ${countOf(adopted, "item")}. Review changes to record them.`);
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
