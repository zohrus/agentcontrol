/** The rules file the Modify agent reads, shipped with every default-UI release as AGENTS.md. */
export const AGENT_RULES = `# Rules for the Modify agent

You change this UI project to do what the user asks. It is the user's own app.

- Data only through @agentcontrol/sdk. Never call the app's HTTP API directly.
- Only the bundled libraries are available. Do not run or ask for npm install.
- Prefer editing layout.json for arrangement changes.
- Put new features in your own files, plugged into the default UI's named slots, instead of
  editing the default components. Template updates then rarely conflict with your work.
- Edit files only inside this folder. You cannot run shell commands or reach the web.
- The app typechecks and builds your result after your turn and sends you any errors to fix.
`;

const INTRO = "You are the Modify agent of AgentControl. Change the UI project in this folder.";

/**
 * The short instruction that starts every Modify session. The rules come from this release, never
 * from the AGENTS.md in staging: the agent can edit that file, and its edits must not loosen them.
 */
export const INSTRUCTION = `${INTRO}\n\n${AGENT_RULES}`.trim();

/** The first message of a session: the instruction, then what the user asked for. */
export function requestPrompt(options: { instruction: string; request: string }): string {
  return `${options.instruction}\n\nThe user asks:\n${options.request}`;
}

const MAX_OUTPUT_LINES = 60;
const MAX_OUTPUT_CHARS = 4000;

/** The tail of a tool's output, short enough to send back to the agent. */
export function trimOutput(output: string): string {
  const lines = output.trim().split("\n").slice(-MAX_OUTPUT_LINES).join("\n");
  return lines.length > MAX_OUTPUT_CHARS ? lines.slice(-MAX_OUTPUT_CHARS) : lines;
}

/** What the agent hears when the checks failed: the failing step's output, trimmed. */
export function checkFeedback(failed: { name: string; output: string }): string {
  return `The ${failed.name} failed. Fix these errors, then stop.\n\n${trimOutput(failed.output)}`;
}

/** The prompt for an update that did not merge cleanly (or did not pass the checks afterwards). */
export function updatePrompt(options: {
  instruction: string;
  version: string;
  conflictedFiles: string[];
  keptRequests: string[];
}): string {
  const { instruction, version, conflictedFiles, keptRequests } = options;
  const files = conflictedFiles.map((file) => `- ${file}`).join("\n");
  const requests = keptRequests.map((request) => `- ${request}`).join("\n");
  return [
    instruction,
    `The default UI was updated to ${version} and merged into the user's UI.`,
    files === "" ? "" : `These files have conflict markers (<<<<<<<, =======, >>>>>>>):\n${files}`,
    "Resolve every conflict so both the new default UI and the user's earlier changes survive.",
    requests === ""
      ? ""
      : `The user's earlier requests, so you rebuild what they wanted:\n${requests}`,
  ]
    .filter((part) => part !== "")
    .join("\n\n");
}
