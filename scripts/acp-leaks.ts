// `bun run acp-leaks`: fails when raw ACP vocabulary shows up outside the relay's normalise module.
// Only packages/relay/src/acp-normalise/ may know ACP update shapes (and the mock agent, which
// speaks real ACP). Everything else reads the normalised `AgentUpdate`s the relay attaches to events.
// See docs/decisions/2026-11-22-normalised-agent-updates.md.
import { readFileSync } from "node:fs";

/** Where raw ACP must not appear. */
const SCANNED = ["packages/app", "packages/sdk", "packages/ui-template", "e2e/support/expect"];

/** ACP field, update-kind and method names, and the ACP SDK package. */
const ACP_VOCABULARY = new RegExp(
  [
    "sessionUpdate",
    "(?:agent|user)_(?:message|thought)_chunk",
    "tool_call(?:_update)?\\b",
    "(?:usage|plan|current_mode|config_option|session_info)_update",
    "available_commands_update",
    "session/(?:update|prompt|new|load|request_permission|set_mode)",
    "rawInput",
    "rawOutput",
    "_claude/",
    "@agentclientprotocol",
  ].join("|"),
);

/** Files allowed to name ACP, each with the reason. */
const ALLOWED: Record<string, string> = {
  "e2e/support/expect/raw-message-expectations.ts": "proves the raw message is kept unchanged",
  "e2e/support/expect/agent-expectations.ts": "tests the mock agent itself, which speaks real ACP",
  "e2e/support/expect/recording-expectations.ts":
    "names the adapter messages left as `other` on purpose; an `other` update carries the agent's own name",
};

const SKIPPED = /(^|\/)(node_modules|dist|coverage)\//;

function filesToScan(): string[] {
  const glob = new Bun.Glob("**/*.{ts,tsx}");
  const found = SCANNED.flatMap((root) =>
    [...glob.scanSync({ cwd: root })].map((f) => `${root}/${f}`),
  );
  return found.filter((file) => !SKIPPED.test(file) && !(file in ALLOWED)).sort();
}

function leaksIn(file: string): string[] {
  const lines = readFileSync(file, "utf8").split("\n");
  return lines.flatMap((line, index) => {
    const found = ACP_VOCABULARY.exec(line);
    return found ? [`${file}:${String(index + 1)}: raw ACP name "${found[0]}"`] : [];
  });
}

const leaks = filesToScan().flatMap(leaksIn);
if (leaks.length > 0) {
  console.error(leaks.join("\n"));
  console.error(
    `\n${String(leaks.length)} raw ACP name(s) outside the relay's normalise module. Read the normalised` +
      " `updates` of the event instead (docs/decisions/2026-11-22-normalised-agent-updates.md).",
  );
  process.exit(1);
}
console.log("acp-leaks: no raw ACP names outside the allowed files");
