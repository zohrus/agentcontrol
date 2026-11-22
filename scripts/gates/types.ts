export interface GateCase {
  /** Human-readable gate name, printed in the summary. */
  readonly name: string;
  /** Files to write (path relative to the repo root). Existing files are restored afterwards. */
  readonly files: Readonly<Record<string, string>>;
  readonly command: readonly string[];
  /** Text (case-insensitive) that must appear in the output, proving the sample was the cause. */
  readonly expect: string;
}

export const SAMPLE_DIR = "packages/relay/src/__gate_sample__";
export const OTHER_SAMPLE_DIR = "packages/relay/src/__gate_sample_b__";
export const SAMPLE_FILE = `${SAMPLE_DIR}/sample.ts`;

export const eslintOn = (file: string): readonly string[] => [
  "node_modules/.bin/eslint",
  "--max-warnings",
  "0",
  file,
];

export const repeatLines = (count: number, line: (index: number) => string): string =>
  Array.from({ length: count }, (_, index) => line(index)).join("\n");
