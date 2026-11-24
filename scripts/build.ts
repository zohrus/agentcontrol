// `bun run build`: compiles every binary into dist/, writes dist/manifest.json, and assembles one
// release folder per app platform in dist/release/<os>-<arch>/ (see scripts/build/release.ts).
// `--only <text>` builds just the targets whose file name contains <text>.
// `--linux-app` also builds the Linux x64 app, which is what the smoke test runs.
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildIdentity } from "../packages/protocol/src/build-id.ts";
import { compileTarget } from "./build/compile.ts";
import { describeFiles, formatTable, writeManifest } from "./build/manifest.ts";
import { assembleRelease, releaseFiles } from "./build/release.ts";
import { allTargets, appPlatforms, splitByEntry } from "./build/targets.ts";
import { buildSharedUiParts } from "./build/ui-resources.ts";

const outDir = "dist";
const onlyAt = process.argv.indexOf("--only");
const only = onlyAt === -1 ? "" : (process.argv[onlyAt + 1] ?? "");
const linuxApp = process.argv.includes("--linux-app");
const pkg = (await Bun.file("package.json").json()) as { version?: string };
const version = pkg.version ?? "0.0.0";
const buildId = buildIdentity();
const protocol = (await Bun.file("packages/protocol/package.json").json()) as { version?: string };
// The running code reports the protocol package's version, because that file ships in a release.
if (protocol.version !== version) {
  console.error(
    `packages/protocol/package.json says ${String(protocol.version)} but the release is ${version}. Make them the same.`,
  );
  process.exit(1);
}

const { build, skipped } = splitByEntry(
  allTargets({ linuxApp }).filter((t) => t.name.includes(only)),
);
for (const target of skipped) {
  console.log(`skipping ${target.name}: ${target.entry} does not exist yet`);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const target of build) {
  console.log(`building ${target.name} ...`);
  compileTarget({ target, version, buildId, outDir });
}

const names = build.map((target) => target.name);
const files = await describeFiles(outDir, names);
await writeManifest({ dir: outDir, version, buildId, files });
console.log(`\nAgentControl ${version} (build ${buildId})\n${formatTable(files)}`);

const ready = appPlatforms({ linuxApp }).filter((platform) =>
  Object.values(releaseFiles({ platform, binDir: outDir })).every((path) =>
    names.includes(path.slice(outDir.length + 1)),
  ),
);
for (const platform of appPlatforms({ linuxApp }).filter((p) => !ready.includes(p))) {
  console.log(`no release folder for ${platform}: not every binary it needs was built`);
}
if (ready.length > 0) {
  const sharedDir = join(outDir, ".ui-shared");
  console.log("building the default UI ...");
  const shared = buildSharedUiParts(sharedDir);
  for (const platform of ready) {
    console.log(`assembling release/${platform} ...`);
    await assembleRelease({ platform, binDir: outDir, shared });
  }
  rmSync(sharedDir, { recursive: true, force: true });
}
