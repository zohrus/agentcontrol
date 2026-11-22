/** The items found include one of this kind and name, found for this agent. */
export function expectImportedItem(
  items: { item: { id: string; kind: string; name?: string } }[],
  call: { id: string; kind: string },
): void {
  const found = items.some(({ item }) => item.id === call.id && item.kind === call.kind);
  if (!found) {
    const ids = items.map(({ item }) => item.id).join(", ");
    throw new Error(`expected the import to find ${call.kind} "${call.id}", but it found: ${ids}`);
  }
}

/** The items found include every one of these. */
export function expectImportedItems(
  items: { item: { id: string; kind: string } }[],
  wanted: { id: string; kind: string }[],
): void {
  for (const call of wanted) expectImportedItem(items, call);
}
