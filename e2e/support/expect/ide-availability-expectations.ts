import type { CheckStep } from "@agentcontrol/protocol";
import type { AppAccess, Session } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";

/** The checklist has a code-server line with this status and this text in its detail. */
export function expectChecklistToShowCodeServer(
  steps: CheckStep[],
  expected: { status: CheckStep["status"]; detail: string },
): void {
  const step = steps.find((candidate) => candidate.id === "code-server");
  if (step?.status !== expected.status || !(step.detail ?? "").includes(expected.detail)) {
    throw new Error(
      `expected the checklist to show code-server as ${expected.status} with "${expected.detail}", but it showed ${JSON.stringify(step)}`,
    );
  }
}

/** Asking whether the session's browser VS Code can be opened says no, with this in the reason. */
export async function expectBrowserVsCodeUnavailable(
  call: { app: AppAccess; session: Session },
  reasonIncludes: string,
): Promise<void> {
  await eventually(
    `expected the browser VS Code to be unavailable ("${reasonIncludes}")`,
    async () => {
      const answer = await call.app.sdk.ide.ideStatus(call.session.id);
      if (answer.available) return "it said it was available";
      return answer.reason.includes(reasonIncludes)
        ? undefined
        : `the reason was "${answer.reason}"`;
    },
  );
}

/** Asking whether the session's browser VS Code can be opened says yes. */
export async function expectBrowserVsCodeAvailable(call: {
  app: AppAccess;
  session: Session;
}): Promise<void> {
  const answer = await call.app.sdk.ide.ideStatus(call.session.id);
  if (!answer.available) {
    throw new Error(`expected the browser VS Code to be available, but: ${answer.reason}`);
  }
}

/** Opening the browser VS Code is refused with the stable code `ide-unavailable`. */
export async function expectOpeningToBeRefused(call: {
  app: AppAccess;
  session: Session;
}): Promise<void> {
  const failure = await call.app.sdk.ide.openIde(call.session.id).then(
    () => undefined,
    (error: unknown) => error as { code?: string },
  );
  if (failure?.code !== "ide-unavailable") {
    throw new Error(
      `expected opening to be refused with "ide-unavailable", but got ${JSON.stringify(failure)}`,
    );
  }
}
