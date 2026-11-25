/** A piece of a line: plain text, `code` or **bold**. */
export type Span = { type: "text" | "code" | "bold"; text: string };

/** `code`, or **bold** whose first character is not a space (as in `2 ** 3`). */
const INLINE = /(`[^`\n]+`|\*\*[^\s*][^*\n]*\*\*)/;

function spanOf(part: string): Span {
  if (part.startsWith("`")) return { type: "code", text: part.slice(1, -1) };
  if (part.startsWith("**")) return { type: "bold", text: part.slice(2, -2) };
  return { type: "text", text: part };
}

export function parseInline(text: string): Span[] {
  return text
    .split(INLINE)
    .filter((part) => part !== "")
    .map(spanOf);
}

type Open = { code: number | undefined; bold: number | undefined };

/** Where a `code` span and a **bold** span are still open at the end of the line. */
function openMarks(line: string): Open {
  const marks = [...line.matchAll(/`|\*\*/g)];
  const none: Open = { code: undefined, bold: undefined };
  return marks.reduce((open, mark) => {
    const spaced = /\s/.test(line[mark.index + mark[0].length] ?? "");
    return nextOpen(open, { text: mark[0], index: mark.index, spaced });
  }, none);
}

/** What is open after one more marker: inside `code` only a backtick counts. */
function nextOpen(open: Open, mark: Mark): Open {
  if (open.code !== undefined) return mark.text === "`" ? { ...open, code: undefined } : open;
  if (mark.text === "`") return { ...open, code: mark.index };
  return { ...open, bold: nextBold(open.bold, mark) };
}

type Mark = { text: string; index: number; spaced: boolean };

/** A `**` closes the bold that is open; else it opens one, unless a space follows it (`2 ** 3`). */
function nextBold(bold: number | undefined, mark: Mark): number | undefined {
  if (bold !== undefined) return undefined;
  return mark.spaced ? undefined : mark.index;
}

/** The text without a marker that opens nothing yet (only spaces follow it), else closed by `mark`. */
function closeMark(line: string, call: { at: number | undefined; mark: string }): string {
  const { at, mark } = call;
  if (at === undefined) return line;
  return line.slice(at + mark.length).trim() === "" ? line.slice(0, at) : line + mark;
}

/**
 * An unfinished line as it can be shown without its markers ever showing and then restyling:
 * a lone `*` at the end (maybe half of `**`) waits, an opened `code` or **bold** is closed at the
 * end, and a marker that opens with nothing after it waits.
 */
export function closeInline(line: string): string {
  const text = line.replace(/(?<!\*)\*$/, "");
  const { code, bold } = openMarks(text);
  const withoutCode = closeMark(text, { at: code, mark: "`" });
  return closeMark(withoutCode, { at: bold, mark: "**" });
}
