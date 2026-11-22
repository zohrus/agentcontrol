import { type GateCase, OTHER_SAMPLE_DIR, repeatLines, SAMPLE_DIR } from "./types.ts";

const duplicated = `export function f(input: number[]): number[] {
${repeatLines(30, (i) => `  const step${String(i)} = input.map((value) => value * ${String(i)} + input.length);`)}
  return step0;
}
`;

const ROOT_FILE = "packages/relay/src/__gate_sample_root__.ts";
const RELAY_INDEX = "packages/relay/src/index.ts";
const RELAY_PACKAGE = "packages/relay/package.json";

export const depsCases: readonly GateCase[] = [
  {
    name: "dependency rule: relay imports app",
    expect: "relay-no-upward-imports",
    files: { [`${SAMPLE_DIR}/bad.ts`]: 'import "../../../app/src/index.ts";\nexport {};\n' },
    command: ["bun", "run", "deps"],
  },
  {
    name: "import cycle",
    expect: "no-circular",
    files: {
      [`${SAMPLE_DIR}/a.ts`]: 'import "./b.ts";\nexport {};\n',
      [`${SAMPLE_DIR}/b.ts`]: 'import "./a.ts";\nexport {};\n',
    },
    command: ["bun", "run", "deps"],
  },
  {
    name: "feature internals imported by another feature",
    expect: "feature-internals-from-feature",
    files: {
      [`${SAMPLE_DIR}/index.ts`]: 'import "../__gate_sample_b__/internal.ts";\nexport {};\n',
      [`${OTHER_SAMPLE_DIR}/internal.ts`]: "export {};\n",
    },
    command: ["bun", "run", "deps"],
  },
  {
    name: "feature internals imported by package root file",
    expect: "feature-internals-from-elsewhere",
    files: {
      [ROOT_FILE]: 'import "./__gate_sample__/internal.ts";\nexport {};\n',
      [`${SAMPLE_DIR}/internal.ts`]: "export {};\n",
    },
    command: ["bun", "run", "deps"],
  },
];

export const hygieneCases: readonly GateCase[] = [
  {
    name: "knip: unused export",
    expect: "unusedExport",
    files: {
      [RELAY_INDEX]: 'export { used } from "./__gate_sample__/lib.ts";\n',
      [`${SAMPLE_DIR}/lib.ts`]: "export const used = 1;\nexport const unusedExport = 2;\n",
    },
    command: ["bun", "run", "knip"],
  },
  {
    name: "knip: unused file",
    expect: "__gate_sample__/orphan.ts",
    files: { [`${SAMPLE_DIR}/orphan.ts`]: "export const orphan = 1;\n" },
    command: ["bun", "run", "knip"],
  },
  {
    name: "knip: unused dependency",
    expect: "left-pad",
    files: {
      [RELAY_PACKAGE]: `{ "name": "@agentcontrol/relay", "version": "0.0.0", "private": true, "type": "module", "exports": { ".": "./src/index.ts" }, "dependencies": { "left-pad": "1.3.0" } }\n`,
    },
    command: ["bun", "run", "knip"],
  },
  {
    name: "jscpd: duplicated code",
    expect: "Found",
    files: { [`${SAMPLE_DIR}/dup-a.ts`]: duplicated, [`${SAMPLE_DIR}/dup-b.ts`]: duplicated },
    command: ["bun", "run", "dup"],
  },
  {
    name: "biome: badly formatted file",
    expect: "dup-format",
    files: { [`${SAMPLE_DIR}/dup-format.ts`]: "export   const   x=1\n" },
    command: ["bun", "run", "format:check"],
  },
];
