import type { CheckStep, ConnectionState, WorkspaceInfo } from "@agentcontrol/sdk";
import type { AppAccess } from "../setup/app.ts";
import type { ApiOutcome } from "../setup/app-attempt.ts";
import { eventually } from "../setup/eventually.ts";

/** The workspace is in this connection state, and when it is not good it says why in words. */
export function expectWorkspaceToBe(workspace: WorkspaceInfo, state: ConnectionState): void {
  if (workspace.state !== state) {
    const why = workspace.reason === undefined ? "" : ` (${workspace.reason})`;
    throw new Error(
      `expected workspace "${workspace.label}" to be ${state}, but it is ${workspace.state}${why}`,
    );
  }
}

/** The workspace's reason for not being connected mentions this, in plain words. */
export function expectWorkspaceToExplain(workspace: WorkspaceInfo, saying: string): void {
  if (!workspace.reason?.includes(saying)) {
    throw new Error(
      `expected the reason for workspace "${workspace.label}" to say "${saying}", but it says ${JSON.stringify(workspace.reason)}`,
    );
  }
}

/** The live stream told the app that the workspace reached this state (it is already, or will be). */
export async function expectWorkspaceToBecome(
  app: AppAccess,
  call: { workspace: WorkspaceInfo; state: ConnectionState },
): Promise<void> {
  const { workspace, state } = call;
  await app.workspaceChanges.waitFor(
    (change) => change.id === workspace.id && change.state === state,
    `expected the live stream to say workspace "${workspace.label}" became ${state}`,
  );
}

/** The workspace list shows the workspace in this state, eventually. */
export async function expectWorkspaceListedAs(
  app: AppAccess,
  call: { workspace: WorkspaceInfo; state: ConnectionState },
): Promise<void> {
  const { workspace, state } = call;
  await eventually(`expected workspace "${workspace.label}" to be listed as ${state}`, async () => {
    const listed = (await app.sdk.workspaces.list()).find((each) => each.id === workspace.id);
    return listed?.state === state ? undefined : `it is ${listed?.state ?? "not listed"}`;
  });
}

/** The checklist has every one of these steps, and each passed. */
export function expectChecklistToPass(steps: CheckStep[], ids: string[]): void {
  const notOk = ids.filter((id) => steps.find((step) => step.id === id)?.status !== "ok");
  if (notOk.length > 0) {
    const seen = steps.map((step) => `${step.id}: ${step.status}`).join(", ");
    throw new Error(
      `expected checklist steps ${notOk.join(", ")} to be ok, but the checklist is ${seen}`,
    );
  }
}

/** Whether the step is as wanted: its status, and its detail mentions `saying`. */
function stepIsAs(
  step: CheckStep | undefined,
  wanted: { status: string; saying: string },
): boolean {
  return step?.status === wanted.status && (step.detail ?? "").includes(wanted.saying);
}

const describeStep = (step: CheckStep | undefined): string =>
  step ? `${step.status}: ${step.detail ?? "no detail"}` : "missing";

/** The checklist has this step with this status, and its detail mentions `saying` if given. */
export function expectChecklistStepToBe(
  steps: CheckStep[],
  wanted: { id: string; status: CheckStep["status"]; saying?: string },
): void {
  const step = steps.find((each) => each.id === wanted.id);
  const saying = wanted.saying ?? "";
  if (stepIsAs(step, { status: wanted.status, saying })) return;
  const expectation = `expected checklist step "${wanted.id}" to be ${wanted.status} saying "${saying}"`;
  throw new Error(`${expectation}, but it is ${describeStep(step)}`);
}

/** The refusal's message, which people read, contains this text. */
export function expectRefusalToSay(outcome: ApiOutcome<unknown>, saying: string): void {
  const message = outcome.ok ? undefined : outcome.message;
  if (!message?.includes(saying)) {
    throw new Error(
      `expected the refusal to say "${saying}", but it says ${JSON.stringify(message)}`,
    );
  }
}

/** These are exactly the host names offered for adding a workspace. */
export function expectHostAliasesToBe(aliases: string[], wanted: string[]): void {
  if (JSON.stringify(aliases) !== JSON.stringify(wanted)) {
    throw new Error(`expected the host names ${wanted.join(", ")}, but got ${aliases.join(", ")}`);
  }
}
