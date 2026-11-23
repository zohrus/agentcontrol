import { type CheckStep, RelayName } from "@agentcontrol/protocol";
import type { Link } from "../sync/index.ts";
import { type Reporter, reported, silent } from "./progress.ts";

/** One line of the checklist. */
export function step(
  id: string,
  label: string,
  outcome: { status: CheckStep["status"]; detail?: string },
): CheckStep {
  const { status, detail } = outcome;
  return { id, label, status, ...(detail === undefined ? {} : { detail }) };
}

/** The relay's own checks as one step: it passes when all do, else it names the first failure. */
function agentsStep(steps: CheckStep[]): CheckStep {
  const failed = steps.find((each) => each.status === "failed");
  if (failed === undefined) return step("agents", "Find agents", { status: "ok" });
  const detail = `${failed.label}: ${failed.detail ?? "failed."}`;
  return step("agents", "Find agents", { status: "failed", detail });
}

async function reposStep(link: Link): Promise<CheckStep> {
  const { repos } = await link.call(RelayName.reposList, {});
  const detail = repos.length === 0 ? "None yet." : `${String(repos.length)} registered.`;
  return step("repos", "Repositories", { status: "ok", detail });
}

/** The checks the relay itself runs (machine, git, agents), then the repositories it knows. */
export async function checkThroughRelay(
  link: Link,
  report: Reporter = silent,
): Promise<CheckStep[]> {
  let relaySteps: CheckStep[] = [];
  await reported({
    report,
    begin: { id: "agents", label: "Find agents", message: "Checking the machine and its agents." },
    work: async () => {
      relaySteps = (await link.call(RelayName.workspaceCheck, { agents: true })).steps;
      return agentsStep(relaySteps);
    },
  });
  const repos = await reported({
    report,
    begin: { id: "repos", label: "Repositories", message: "Listing the repositories." },
    work: () => reposStep(link),
  });
  return [...relaySteps, repos];
}
