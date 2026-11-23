/** The modes the Claude Code adapter offers, with the ids and names it uses. */
const CLAUDE_MODES = [
  { id: "default", name: "Manual", description: "Always ask before making changes" },
  { id: "acceptEdits", name: "Accept edits", description: "Automatically accept all file edits" },
  { id: "plan", name: "Plan", description: "Create a plan before making changes" },
  { id: "auto", name: "Auto", description: "Claude handles permission decisions" },
  { id: "bypassPermissions", name: "Bypass permissions", description: "Accepts all permissions" },
];

/**
 * The permission mode of the agent. Without a start mode the agent offers no modes and always
 * asks, like the adapters that have none; with one it behaves like Claude Code, which only asks in
 * "default" (Manual).
 */
export function createModes(startsIn: string | undefined) {
  let current = startsIn;
  return {
    /** The `modes` of the `session/new` answer, or nothing when the agent has no modes. */
    offered: () =>
      current === undefined
        ? {}
        : { modes: { currentModeId: current, availableModes: CLAUDE_MODES } },
    switchTo: (modeId: string): void => {
      current = modeId;
    },
    asksBeforeActing: (): boolean => current === undefined || current === "default",
  };
}
