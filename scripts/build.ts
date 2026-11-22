// `bun run build`: compiles every binary into dist/ and writes dist/manifest.json.
// `bun run build --only <text>` builds just the targets whose file name contains <text>.
import { mkdirSync, rmSync } from "node:fs";
import { compileTarget } from "./build/compile.ts";
import { describeFiles, formatTable, writeManifest } from "./build/manifest.ts";
import { allTargets, splitByEntry } from "./build/targets.ts";

const outDir = "dist";
const onlyAt = process.argv.indexOf("--only");
const only = onlyAt === -1 ? "" : (process.argv[onlyAt + 1] ?? "");
const pkg = (await Bun.file("package.json").json()) as { version?: string };
const version = pkg.version ?? "0.0.0";

const { build, skipped } = splitByEntry(allTargets().filter((t) => t.name.includes(only)));
for (const target of skipped) {
  console.log(`skipping ${target.name}: ${target.entry} does not exist yet`);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const target of build) {
  console.log(`building ${target.name} ...`);
  compileTarget({ target, version, outDir });
}

const files = await describeFiles(
  outDir,
  build.map((target) => target.name),
);
await writeManifest({ dir: outDir, version, files });
console.log(`\nAgentControl ${version}\n${formatTable(files)}`);
