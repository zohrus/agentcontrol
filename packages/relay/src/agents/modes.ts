import type { AgentKind } from "@agentcontrol/protocol";

/**
 * The ACP mode an agent must run in so that it asks before it acts. Claude Code starts in the mode
 * the user's own settings pick ("auto" on some machines), in which edits and commands are never
 * asked about, so a session would never wait on the user. Its "default" mode (shown as "Manual")
 * asks. Other agents keep the mode they start in.
 */
const ASKING_MODE: Partial<Record<AgentKind, string>> = { "claude-code": "default" };

interface OfferedModes {
  currentModeId: string;
  availableModes: { id: string }[];
}

function needsSwitch(wanted: string, offered: OfferedModes): boolean {
  return offered.currentModeId !== wanted && offered.availableModes.some(({ id }) => id === wanted);
}

/** The mode to switch to right after `session/new`, or undefined when the agent is already fine. */
export function modeToSwitchTo(
  kind: AgentKind,
  offered: OfferedModes | null | undefined,
): string | undefined {
  const wanted = ASKING_MODE[kind];
  if (wanted === undefined || !offered) return undefined;
  return needsSwitch(wanted, offered) ? wanted : undefined;
}
