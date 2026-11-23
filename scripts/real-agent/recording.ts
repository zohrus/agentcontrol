import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const TEMP_FOLDER = /\/tmp\/agentcontrol-(app|repo|ui-template|relay)-[A-Za-z0-9]+/g;
/** Keys whose values describe the account behind the run, not the session. */
const ACCOUNT_KEYS = ["_claude/rateLimit"];

/** The slash commands and skills the machine has are its own business; a few show the shape. */
const SHORTENED_LISTS = ["availableCommands"];
const KEPT_ITEMS = 2;

function scrubbed(key: string, value: unknown): unknown {
  if (ACCOUNT_KEYS.includes(key)) return {};
  const inner = withoutAccountKeys(value);
  return SHORTENED_LISTS.includes(key) && Array.isArray(inner) ? inner.slice(0, KEPT_ITEMS) : inner;
}

function withoutAccountKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutAccountKeys);
  if (typeof value !== "object" || value === null) return value;
  const entries = Object.entries(value).map(([key, inner]) => [key, scrubbed(key, inner)]);
  return Object.fromEntries(entries) as unknown;
}

function scrubLine(line: string): string {
  const text = JSON.stringify(withoutAccountKeys(JSON.parse(line)));
  return text.replaceAll(TEMP_FOLDER, "/tmp/ac-$1").replaceAll(homedir(), "/home/user");
}

/** Keeps the machine out of a recording: temp folders get stable names, and the account's rate limits go. */
export function scrub(log: string): string {
  const lines = log.split("\n").filter((line) => line.trim() !== "");
  return `${lines.map(scrubLine).join("\n")}\n`;
}

/** Saves the relay's own event log of a session, scrubbed, as `<folder>/<name>.jsonl`. */
export async function saveRecording(options: {
  logFile: string;
  folder: string;
  name: string;
}): Promise<void> {
  await mkdir(options.folder, { recursive: true });
  const log = await Bun.file(options.logFile).text();
  await Bun.write(join(options.folder, `${options.name}.jsonl`), scrub(log));
}
