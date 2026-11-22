import { type CheckStep, RelayName } from "@agentcontrol/protocol";
import type { Link } from "../sync/index.ts";

/** One line of the checklist. */
export function step(
  id: string,
  label: string,
  outcome: { status: CheckStep["status"]; detail?: string },
): CheckStep {
  const { status, detail } = outcome;
  return { id, label, status, ...(detail === undefined ? {} : { detail }) };
}

/** The checks the relay itself runs (machine, git, agents), then the repositories it knows. */
export async function checkThroughRelay(link: Link): Promise<CheckStep[]> {
  const { steps } = await link.call(RelayName.workspaceCheck, { agents: true });
  const { repos } = await link.call(RelayName.reposList, {});
  const detail = repos.length === 0 ? "None yet." : `${String(repos.length)} registered.`;
  return [...steps, step("repos", "Repositories", { status: "ok", detail })];
}
