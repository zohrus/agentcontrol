/** No tracked file has another mode than before: installing must not make source files executable. */
export function expectNoFileToChangeMode(
  before: Record<string, string>,
  after: Record<string, string>,
): void {
  const changed = Object.keys(after).filter((path) => before[path] !== after[path]);
  if (changed.length === 0) return;
  const described = changed.map(
    (path) => `${path} (${before[path] ?? "absent"} became ${after[path] ?? "absent"})`,
  );
  throw new Error(
    `expected installing to change no file mode, but it changed: ${described.join(", ")}`,
  );
}
