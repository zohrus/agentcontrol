export const columns: string[] = ["Title", "Status"];

export function renderTable(): string {
  return columns.join(" | ");
}
