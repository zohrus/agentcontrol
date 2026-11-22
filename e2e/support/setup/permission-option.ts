/** The id of the option of the given kind that the agent offered for a permission request. */
export function optionOfKind(
  options: { kind: string; optionId: string }[],
  kind: string,
  title: string,
): string {
  const option = options.find((candidate) => candidate.kind === kind);
  if (!option) throw new Error(`the agent offered no "${kind}" option for "${title}"`);
  return option.optionId;
}
