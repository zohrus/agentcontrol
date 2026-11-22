import { eslintOn, type GateCase, repeatLines, SAMPLE_FILE } from "./types.ts";

const lintCase = (name: string, expect: string, source: string): GateCase => ({
  name,
  expect,
  files: { [SAMPLE_FILE]: source },
  command: eslintOn(SAMPLE_FILE),
});

const sixBranches = `export function f(a: number): number {
  if (a === 1) return 1;
  if (a === 2) return 2;
  if (a === 3) return 3;
  if (a === 4) return 4;
  if (a === 5) return 5;
  return 0;
}
`;

const deepNesting = `export function f(a: number[]): number {
  let total = 0;
  for (const x of a) {
    if (x > 0) {
      for (const y of a) {
        if (y > x) {
          total += y;
        }
      }
    }
  }
  return total;
}
`;

const threeDeep = `export function f(a: number): number {
  if (a > 0) {
    if (a > 1) {
      if (a > 2) {
        return a;
      }
    }
  }
  return 0;
}
`;

const thirteenStatements = `export function f(): number {
${repeatLines(13, (i) => `  const v${String(i)} = ${String(i)};`)}
  return v0;
}
`;

const longFunction = `export function f(): number {
${repeatLines(31, (i) => `  Math.abs(${String(i)});`)}
  return 1;
}
`;

const noReason = `export function f(): void {
  // eslint-disable-next-line no-console
  console.log("x");
}
`;

export const lintCases: readonly GateCase[] = [
  lintCase("cyclomatic complexity (complexity > 5)", "complexity", sixBranches),
  lintCase("cognitive complexity (> 8)", "cognitive-complexity", deepNesting),
  lintCase("max-depth (> 2)", "max-depth", threeDeep),
  lintCase(
    "max-params (> 3)",
    "max-params",
    "export const f = (a: number, b: number, c: number, d: number): number => a + b + c + d;\n",
  ),
  lintCase("max-statements (> 12)", "max-statements", thirteenStatements),
  lintCase("max-lines-per-function (> 30)", "max-lines-per-function", longFunction),
  lintCase(
    "max-lines (> 200)",
    "max-lines",
    `${repeatLines(201, (i) => `export const v${String(i)} = ${String(i)};`)}\n`,
  ),
  lintCase(
    "max-nested-callbacks (> 2)",
    "max-nested-callbacks",
    "export const f = [1].map(() => [2].map(() => [3].map(() => 4)));\n",
  ),
  lintCase(
    "no-nested-ternary",
    "no-nested-ternary",
    "export const f = (a: number): number => (a > 1 ? 1 : a > 0 ? 2 : 3);\n",
  ),
  lintCase("explicit any", "no-explicit-any", "export const f: any = 1;\n"),
  lintCase(
    "floating promise",
    "no-floating-promises",
    "export function f(): void {\n  Promise.resolve(1);\n}\n",
  ),
  lintCase("eslint-disable without reason", "require-description", noReason),
  lintCase(
    "blanket eslint-disable",
    "no-unlimited-disable",
    "/* eslint-disable */\nexport const f = 1;\n",
  ),
  lintCase(
    "unused eslint-disable directive",
    "unused",
    "// eslint-disable-next-line no-console -- not needed here\nexport const f = 1;\n",
  ),
];
