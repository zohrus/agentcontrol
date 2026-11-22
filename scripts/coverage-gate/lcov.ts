import { Glob } from "bun";

/** Line number to how often it ran. Only executable lines appear. */
export type LineHits = Map<number, number>;
export type LcovFiles = Map<string, LineHits>;

function addHits(into: LineHits | undefined, record: string): void {
  const [lineNumber, hits] = record.split(",").map(Number);
  into?.set(lineNumber ?? 0, hits ?? 0);
}

function recordLine(files: LcovFiles, current: LineHits | undefined, line: string) {
  if (line.startsWith("DA:")) addHits(current, line.slice(3));
  if (!line.startsWith("SF:")) return current;
  const fresh: LineHits = new Map();
  files.set(line.slice(3), fresh);
  return fresh;
}

/** Reads the SF / DA records of an lcov file; other record types are not needed. */
export function parseLcov(text: string): LcovFiles {
  const files: LcovFiles = new Map();
  let current: LineHits | undefined;
  for (const line of text.split("\n")) current = recordLine(files, current, line);
  return files;
}

/** The union over several runs: a line is covered when any run executed it. */
export function mergeLcov(parts: LcovFiles[]): LcovFiles {
  const merged: LcovFiles = new Map();
  for (const part of parts) {
    for (const [file, lines] of part) {
      const into = merged.get(file) ?? new Map<number, number>();
      lines.forEach((hits, line) => into.set(line, (into.get(line) ?? 0) + hits));
      merged.set(file, into);
    }
  }
  return merged;
}

/** Reads every `<dir>/<name>/lcov.info` and merges them. */
export async function readParts(dir: string): Promise<LcovFiles> {
  const paths = [...new Glob("*/lcov.info").scanSync({ cwd: dir })].sort();
  const texts = await Promise.all(paths.map((path) => Bun.file(`${dir}/${path}`).text()));
  return mergeLcov(texts.map(parseLcov));
}

function recordOf([file, lines]: [string, LineHits]): string[] {
  const sorted = [...lines].sort(([a], [b]) => a - b);
  const covered = sorted.filter(([, hits]) => hits > 0).length;
  const rows = sorted.map(([line, hits]) => `DA:${String(line)},${String(hits)}`);
  return [
    `SF:${file}`,
    ...rows,
    `LF:${String(sorted.length)}`,
    `LH:${String(covered)}`,
    "end_of_record",
  ];
}

/** Writes lcov text for the given files, sorted by path. */
export function formatLcov(files: LcovFiles): string {
  const sorted = [...files].sort(([a], [b]) => a.localeCompare(b));
  return `${sorted.flatMap(recordOf).join("\n")}\n`;
}
