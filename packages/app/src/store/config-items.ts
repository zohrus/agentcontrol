import { ConfigItem, type ScopedItem } from "@agentcontrol/protocol";
import type { Db } from "./db.ts";
import { configItems, configScopes } from "./schema.ts";

type ScopeRow = typeof configScopes.$inferSelect;

function itemRows(scoped: ScopedItem[]): (typeof configItems.$inferInsert)[] {
  const byId = new Map(
    scoped.map(({ item }) => [
      item.id,
      { id: item.id, kind: item.kind, bodyJson: JSON.stringify(item) },
    ]),
  );
  return [...byId.values()];
}

const scopeRows = (scoped: ScopedItem[]): ScopeRow[] =>
  scoped.map(({ item, scope, enabled }) => ({
    itemId: item.id,
    scope: scope.scope,
    repoPath: scope.repoPath ?? "",
    enabled,
  }));

/** Replace every stored config item and scope with the given ones, all or nothing. */
export function replaceConfigItems(db: Db, scoped: ScopedItem[]): void {
  db.transaction((tx) => {
    tx.delete(configScopes).run();
    tx.delete(configItems).run();
    for (const row of itemRows(scoped)) tx.insert(configItems).values(row).run();
    for (const row of scopeRows(scoped)) tx.insert(configScopes).values(row).run();
  });
}

const orderKey = (row: ScopeRow): string => `${row.itemId}|${row.scope}|${row.repoPath}`;

function toScoped(row: ScopeRow, body: string | undefined): ScopedItem {
  const scope =
    row.repoPath === "" ? { scope: row.scope } : { scope: row.scope, repoPath: row.repoPath };
  return { item: ConfigItem.parse(JSON.parse(body ?? "null")), scope, enabled: row.enabled };
}

/** Every stored item with each of its scopes, in a stable order. */
export function listConfigItems(db: Db): ScopedItem[] {
  const bodies = new Map(
    db
      .select()
      .from(configItems)
      .all()
      .map((r) => [r.id, r.bodyJson]),
  );
  const rows = db.select().from(configScopes).all();
  return rows
    .sort((a, b) => orderKey(a).localeCompare(orderKey(b)))
    .map((row) => toScoped(row, bodies.get(row.itemId)));
}
