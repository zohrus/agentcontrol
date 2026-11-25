/** A piece of a line: plain text, `code` or **bold**. */
export type Span = { type: "text" | "code" | "bold"; text: string };

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/;

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
  return marks.reduce((open, mark) => nextOpen(open, { text: mark[0], index: mark.index }), none);
}

/** What is open after one more marker: inside `code` only a backtick counts. */
function nextOpen(open: Open, mark: { text: string; index: number }): Open {
  if (open.code !== undefined) return mark.text === "`" ? { ...open, code: undefined } : open;
  if (mark.text === "`") return { ...open, code: mark.index };
  return { ...open, bold: open.bold === undefined ? mark.index : undefined };
}

/** The text without a marker that opens nothing yet (it is the last thing on the line), else closed by `mark`. */
function closeMark(line: string, call: { at: number | undefined; mark: string }): string {
  const { at, mark } = call;
  if (at === undefined) return line;
  return at + mark.length === line.length ? line.slice(0, at) : line + mark;
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
