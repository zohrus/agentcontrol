// Turns the V8 coverage of one script the browser ran into line hits of the source it came from.
import { decodeMappings } from "./mappings.ts";

/** What Playwright reports for one script (the parts used here). */
export interface ScriptCoverage {
  url: string;
  /** The code the browser ran: Vite's output, ending in an inline source map. */
  source: string;
  functions: Array<{ ranges: Array<{ startOffset: number; endOffset: number; count: number }> }>;
}

/** Original line number (1-based) to how often it ran. Only lines that compile to code appear. */
export type LineHits = Map<number, number>;

const INLINE_MAP =
  /\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,(\S+)\s*$/;

/** The `mappings` string of the source map the script carries, or "" when it has none. */
function inlineMappings(source: string): string {
  const encoded = INLINE_MAP.exec(source)?.[1];
  if (encoded === undefined) return "";
  const map = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as { mappings: string };
  return map.mappings;
}

/** How often V8 ran each character of the script. Inner ranges override the ones around them. */
function countsOf(script: ScriptCoverage): Int32Array {
  const counts = new Int32Array(script.source.length);
  const ranges = script.functions.flatMap((fn) => fn.ranges);
  ranges.sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
  for (const range of ranges) counts.fill(range.count, range.startOffset, range.endOffset);
  return counts;
}

/** The offset where each line of the script starts. */
function lineStarts(source: string): number[] {
  const starts = [0];
  for (let at = source.indexOf("\n"); at !== -1; at = source.indexOf("\n", at + 1)) {
    starts.push(at + 1);
  }
  return starts;
}

/**
 * Original lines and how often they ran. A line ran when any code mapped to it ran; a line
 * with no code mapped to it (types, comments, blank lines) is not executable and is left out.
 */
export function lineHitsOf(script: ScriptCoverage): LineHits {
  const hits: LineHits = new Map();
  const mappings = inlineMappings(script.source);
  const counts = countsOf(script);
  const starts = lineStarts(script.source);
  for (const segment of decodeMappings(mappings)) {
    const ran = counts[(starts[segment.line] ?? 0) + segment.column] ?? 0;
    hits.set(segment.originalLine, Math.max(hits.get(segment.originalLine) ?? 0, ran));
  }
  return hits;
}
