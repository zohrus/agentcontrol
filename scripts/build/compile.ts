import { join } from "node:path";
import type { Target } from "./targets.ts";

/** Compiles one target into `outDir` with the version baked in. Throws when bun fails. */
export function compileTarget(options: { target: Target; version: string; outDir: string }): void {
  const { target, version, outDir } = options;
  const run = Bun.spawnSync(
    [
      "bun",
      "build",
      "--compile",
      `--target=${target.bunTarget}`,
      "--define",
      `AGENTCONTROL_VERSION=${JSON.stringify(version)}`,
      target.entry,
      "--outfile",
      join(outDir, target.name),
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  if (run.exitCode !== 0) {
    throw new Error(`Building ${target.name} failed:\n${run.stderr.toString()}`);
  }
}
