/** Text boxes hold lists as one line each, and name/value pairs as `NAME=value` lines. */

/** The non-empty lines of a text box, trimmed. */
export function linesOf(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** `NAME<separator>value` lines as a record; a line without the separator is reported. */
export function parsePairs(
  text: string,
  separator: string,
): { pairs: Record<string, string>; bad: string | undefined } {
  const pairs: Record<string, string> = {};
  let bad: string | undefined;
  for (const line of linesOf(text)) {
    const at = line.indexOf(separator);
    if (at < 1) bad ??= line;
    else pairs[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return { pairs, bad };
}

/** A record as `NAME<separator>value` lines. */
export function pairsText(pairs: Record<string, string> | undefined, separator: string): string {
  return Object.entries(pairs ?? {})
    .map(([name, value]) => `${name}${separator}${value}`)
    .join("\n");
}

/** A name as part of an id: letters, digits and dashes only. */
export function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}
