import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestEnd } from "../setup/cleanup.ts";

/** A machine whose git has no name and email yet, and a way for the user to set them. */
export interface GitWithoutIdentity {
  /** Environment for the relay, so its git reads only this machine's (empty) git config. */
  relayEnv: Record<string, string>;
  /** The user runs `git config --global user.name` and `user.email`. */
  setsUpTheirIdentity(): Promise<void>;
}

export async function gitWithoutIdentity(): Promise<GitWithoutIdentity> {
  const folder = await mkdtemp(join(tmpdir(), "agentcontrol-gitconfig-"));
  onTestEnd(() => rm(folder, { recursive: true, force: true }));
  const config = join(folder, "gitconfig");
  // Without this, git guesses a name and email from the user and host names and may succeed.
  await Bun.write(config, "[user]\n\tuseConfigOnly = true\n");
  return {
    relayEnv: { GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: "1" },
    setsUpTheirIdentity: async () => {
      await Bun.write(
        config,
        "[user]\n\tuseConfigOnly = true\n\tname = Test User\n\temail = test@example.com\n",
      );
    },
  };
}
