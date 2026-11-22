/** The fixture UI's session table file (src/session-table.ts) with these columns. */
export function sessionTableWith(...columns: string[]): string {
  const list = columns.map((column) => `"${column}"`).join(", ");
  return `export const columns: string[] = [${list}];

export function renderTable(): string {
  return columns.join(" | ");
}
`;
}

/** A session table that does not typecheck: a number where the columns are strings. */
export const sessionTableWithTypeError = `export const columns: string[] = [1];

export function renderTable(): string {
  return columns.join(" | ");
}
`;
