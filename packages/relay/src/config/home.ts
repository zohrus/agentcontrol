import { homedir } from "node:os";

/** Where agent config lives: the user's real home, unless AGENTCONTROL_CONFIG_HOME says otherwise. */
export function configHome(env: Record<string, string | undefined> = process.env): string {
  const override = env.AGENTCONTROL_CONFIG_HOME;
  return override === undefined || override === "" ? homedir() : override;
}
