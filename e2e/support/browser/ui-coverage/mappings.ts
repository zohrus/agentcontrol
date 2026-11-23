// Decodes the `mappings` of a source map (base64 VLQ), the only part of a map coverage needs.

/** One mapped spot: where the generated code starts, and the original line it came from. */
export interface Segment {
  /** 0-based line and column in the generated code. */
  line: number;
  column: number;
  /** Index into the map's `sources`. */
  source: number;
  /** 1-based line in that source. */
  originalLine: number;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const CONTINUATION = 32;
const VALUE_BITS = 5;
const VALUE_MASK = 31;

/** Reads one signed VLQ number from `text`, starting at `from`. */
function readNumber(text: string, from: number): { value: number; next: number } {
  let value = 0;
  let shift = 0;
  let position = from;
  let digit = CONTINUATION;
  while ((digit & CONTINUATION) !== 0) {
    digit = BASE64.indexOf(text.charAt(position));
    position += 1;
    value += (digit & VALUE_MASK) * 2 ** shift;
    shift += VALUE_BITS;
  }
  const magnitude = Math.floor(value / 2);
  return { value: value % 2 === 1 ? -magnitude : magnitude, next: position };
}

/** The numbers of one segment, such as `[column, source, line, column]`. */
function readSegment(text: string): number[] {
  const numbers: number[] = [];
  for (let position = 0; position < text.length; ) {
    const read = readNumber(text, position);
    numbers.push(read.value);
    position = read.next;
  }
  return numbers;
}

/** The running totals every segment is relative to. */
interface Cursor {
  column: number;
  source: number;
  originalLine: number;
}

/** Applies a segment's numbers to the cursor; undefined for a segment that names no source. */
function apply(cursor: Cursor, numbers: number[]): Omit<Segment, "line"> | undefined {
  cursor.column += numbers[0] ?? 0;
  if (numbers.length < 4) return undefined;
  cursor.source += numbers[1] ?? 0;
  cursor.originalLine += numbers[2] ?? 0;
  return { column: cursor.column, source: cursor.source, originalLine: cursor.originalLine + 1 };
}

/** Every segment that points into a source, in generated order. */
export function decodeMappings(mappings: string): Segment[] {
  const cursor: Cursor = { column: 0, source: 0, originalLine: 0 };
  const segments: Segment[] = [];
  mappings.split(";").forEach((lineText, line) => {
    cursor.column = 0;
    for (const text of lineText.split(",").filter((part) => part !== "")) {
      const segment = apply(cursor, readSegment(text));
      if (segment !== undefined) segments.push({ ...segment, line });
    }
  });
  return segments;
}
