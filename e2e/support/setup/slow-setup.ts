import { join } from "node:path";
import type { AppAccess } from "./app.ts";
import { temporaryFolder } from "./release-folder.ts";

/** A repo setup script that does not finish until the test lets it, then succeeds or fails. */
export interface SlowSetup {
  /** The script ends well. */
  finishes(): Promise<void>;
  /** The script prints "setup broke" and ends with an error. */
  breaks(): Promise<void>;
}

/**
 * Gives the repo a setup script that waits for the test's go-ahead. The script waits by itself, so
 * no test has to guess how long setup takes.
 */
export async function theRepoSetupWaitsForTheTest(app: AppAccess): Promise<SlowSetup> {
  const signal = join(await temporaryFolder("agentcontrol-slow-setup-"), "signal");
  const script = [
    `while [ ! -e '${signal}' ]; do sleep 0.05; done`,
    `if [ "$(cat '${signal}')" = ok ]; then echo setup done; else echo setup broke >&2; exit 3; fi`,
  ].join("\n");
  const repo = await app.sdk.repos.add(app.repoPath);
  await app.sdk.repos.setSetup(repo.repoId, { copyFiles: [".env*"], setupScript: script });
  return {
    finishes: async () => {
      await Bun.write(signal, "ok");
    },
    breaks: async () => {
      await Bun.write(signal, "fail");
    },
  };
}
