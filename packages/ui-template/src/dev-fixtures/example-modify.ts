import type { UiUpdate, UiVersionEntry } from "../modify/index.ts";
import { eventKit, toEvents } from "./event-helpers.ts";

/** EXAMPLE DATA: a conversation with the Modify agent, the UI version history and an update. */
const sessionId = "example-modify";
const { acp, text, read, edit } = eventKit(sessionId);

const rawEvents = [
  { kind: "prompt-sent", payload: { text: "Show the cost in the session list rows." } },
  ...read("m1", "src/session-list/session-row.tsx"),
  text("agent_message_chunk", "The row has room for a cost next to the badge. ", "a1"),
  text("agent_message_chunk", "Adding it as a muted label.", "a1"),
  ...edit("m2", "src/session-list/session-row.tsx", "export function SessionRow() {}\n"),
  acp({ sessionUpdate: "notice", severity: "info", title: "Checks passed" }),
  { kind: "turn-ended", payload: { stopReason: "end_turn" } },
];

export const exampleModifyEvents = toEvents(sessionId, rawEvents, "2026-11-22T10:00:00Z");

const day = (offset: number) => new Date(Date.UTC(2026, 10, 22 - offset, 9, 30)).toISOString();

export const exampleVersions: UiVersionEntry[] = [
  {
    commit: "c4e91a0",
    kind: "change",
    message: "Show the cost in the session list rows",
    createdAt: day(0),
  },
  {
    commit: "b82d7f3",
    kind: "update",
    message: "Updated to default UI 1.1",
    createdAt: day(2),
    templateVersion: "1.1",
  },
  {
    commit: "a17c0de",
    kind: "change",
    message: "Move the changes panel to the left",
    createdAt: day(4),
  },
  { commit: "9f03b61", kind: "undo", message: "Undid: dark purple theme", createdAt: day(5) },
  {
    commit: "7d5e2c8",
    kind: "template",
    message: "Default UI 1.0",
    createdAt: day(9),
    templateVersion: "1.0",
  },
];

export const exampleUpdateAvailable: UiUpdate = { phase: "available", version: "1.2" };

export const exampleUpdateMerged: UiUpdate = {
  phase: "merged",
  version: "1.2",
  keptAutomatically: 4,
  conflictsResolved: 1,
};
