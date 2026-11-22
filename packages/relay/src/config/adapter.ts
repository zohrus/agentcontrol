import type { ConfigAgent, ScopedItem, UnsupportedItem } from "@agentcontrol/protocol";
import { buildFiles } from "./build.ts";
import { type Kind, type Mapper, isSafeId, unsupported } from "./entries.ts";
import type { ConfigCtx, Entry, HarnessAdapter, Mapped, Place, RenderCtx } from "./types.ts";

export interface AdapterDef {
  agent: ConfigAgent;
  mappers: Record<Kind, Mapper>;
  inspect: HarnessAdapter["inspect"];
}

function placeOf(scoped: ScopedItem, ctx: ConfigCtx): Place | undefined {
  if (scoped.scope.scope === "global") return { global: true, base: ctx.homeDir };
  const repo = scoped.scope.repoPath ?? ctx.repoPath;
  return repo === undefined ? undefined : { global: false, base: repo };
}

function mapOne(def: AdapterDef, scoped: ScopedItem, ctx: ConfigCtx): Mapped {
  const { item } = scoped;
  if (!isSafeId(item.id))
    return unsupported("the item id may only use letters, digits and : _ . -");
  const place = placeOf(scoped, ctx);
  if (!place) return unsupported("no repository path was given for this repo-scoped item");
  return def.mappers[item.kind](item, place);
}

export function makeAdapter(def: AdapterDef): HarnessAdapter {
  return {
    agent: def.agent,
    inspect: def.inspect,
    async render(items: ScopedItem[], ctx: RenderCtx) {
      const entries: Entry[] = [];
      const skipped: UnsupportedItem[] = [];
      for (const scoped of items.filter((s) => s.enabled)) {
        const mapped = mapOne(def, scoped, ctx);
        entries.push(...mapped.entries);
        for (const reason of mapped.unsupported) {
          skipped.push({ itemId: scoped.item.id, agent: def.agent, reason });
        }
      }
      const built = await buildFiles({ agent: def.agent, entries, ctx });
      return { ...built, unsupported: [...skipped, ...built.unsupported] };
    },
  };
}
