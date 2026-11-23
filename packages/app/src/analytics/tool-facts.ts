import type { AgentUpdate, FileChange, SessionEvent } from "@agentcontrol/protocol";
import { lineCountsOf } from "./line-counts.ts";

export type ToolFacts = {
  toolCalls: Record<string, number>;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
};

interface Call {
  kind: string;
  failed: boolean;
  files: FileChange[];
}

type ToolUpdate = Extract<AgentUpdate, { type: "tool-started" | "tool-updated" }>;

const isToolUpdate = (update: AgentUpdate): update is ToolUpdate =>
  update.type === "tool-started" || update.type === "tool-updated";

const NEW_CALL: Call = { kind: "other", failed: false, files: [] };

/** What is known of a call after this update: fields the update leaves out stay as they were. */
function merged(known: Call, update: ToolUpdate): Call {
  return {
    kind: update.kind ?? known.kind,
    failed: update.status === undefined ? known.failed : update.status === "failed",
    files: update.files ?? known.files,
  };
}

/** Every tool call of the session, its latest known kind, outcome and changed files. */
function callsOf(events: SessionEvent[]): Map<string, Call> {
  const calls = new Map<string, Call>();
  const updates = events.flatMap((e) => (e.kind === "acp" ? (e.payload.updates ?? []) : []));
  for (const update of updates.filter(isToolUpdate)) {
    calls.set(update.toolCallId, merged(calls.get(update.toolCallId) ?? NEW_CALL, update));
  }
  return calls;
}

function tally(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

/** Tool calls by kind, and the files and lines the calls that did not fail changed. */
export function toolsOfEvents(events: SessionEvent[]): ToolFacts {
  const calls = [...callsOf(events).values()];
  const changes = calls.filter((call) => !call.failed).flatMap((call) => call.files);
  const counts = changes.map(lineCountsOf);
  return {
    toolCalls: tally(calls.map((call) => call.kind)),
    filesChanged: new Set(changes.map((change) => change.path)).size,
    linesAdded: counts.reduce((sum, count) => sum + count.added, 0),
    linesRemoved: counts.reduce((sum, count) => sum + count.removed, 0),
  };
}
