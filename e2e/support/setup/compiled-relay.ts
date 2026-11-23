import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const relayMain = join(import.meta.dir, "../../../packages/relay/src/main.ts");

/**
 * Compiles the relay into a single executable for this machine's own system and CPU (the ssh host
 * in tests is this machine), as `bun run build` does for a release. Undefined, with the reason
 * printed, when the compiler cannot run here.
 */
export function compileRelayForThisMachine(): string | undefined {
  const folder = mkdtempSync(join(tmpdir(), "agentcontrol-compiled-relay-"));
  process.on("exit", () => {
    rmSync(folder, { recursive: true, force: true });
  });
  const outfile = join(folder, "agentcontrol-relay");
  const target = `bun-${process.platform}-${process.arch}`;
  const build = Bun.spawnSync([
    "bun",
    "build",
    "--compile",
    `--target=${target}`,
    relayMain,
    "--outfile",
    outfile,
  ]);
  if (build.exitCode === 0) return outfile;
  console.log(
    `skipping the compiled relay test: bun could not compile for ${target}: ${build.stderr.toString().trim()}`,
  );
  return undefined;
}
