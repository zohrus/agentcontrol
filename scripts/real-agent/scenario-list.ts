import type { Scenario } from "./scenario.ts";
import { cancelATurn, rejectACommand } from "./scenarios/commands.ts";
import { editWithApproval } from "./scenarios/edit-with-approval.ts";
import { appRestart, archive, secondPrompt, usagePerTurn } from "./scenarios/flow.ts";
import { modifyTheUi } from "./scenarios/modify.ts";
import { relayRestart } from "./scenarios/relay-restart.ts";

/**
 * In the order they run. The flow scenarios build on one session (a first, h last) and run before
 * the scenarios with a world of their own: closing any world tears down every running one, because
 * the e2e helpers register their cleanups in one list.
 */
export const scenarios: Scenario[] = [
  { id: "a", name: "edit one line, asking approval first", world: "flow", run: editWithApproval },
  { id: "d", name: "a second prompt in the same session", world: "flow", run: secondPrompt },
  { id: "e", name: "usage per turn", world: "flow", run: usagePerTurn },
  { id: "f", name: "app restart mid-session", world: "flow", run: appRestart },
  { id: "g", name: "relay daemon restart", world: "flow", run: relayRestart },
  { id: "h", name: "archive", world: "flow", run: archive },
  { id: "b", name: "rejecting a command", world: "own", run: rejectACommand },
  { id: "c", name: "cancelling a running turn", world: "own", run: cancelATurn },
  { id: "i", name: "Modify request with the real agent", world: "modify", run: modifyTheUi },
];
