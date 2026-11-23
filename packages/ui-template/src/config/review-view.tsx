import type { ConfigAgent, ConfigPlan } from "@agentcontrol/protocol";
import { Button } from "../components/index.ts";
import { agentName, agentOfPath, allAgents } from "./agents.ts";
import { FileChangeCard } from "./file-change-card.tsx";
import { PlanNotes } from "./plan-notes.tsx";

export type ReviewViewProps = {
  plan: ConfigPlan;
  /** The agents the review was made for. */
  agents: readonly ConfigAgent[];
  /** What each item is called, by id. */
  titles: Readonly<Record<string, string>>;
  onApply: () => void;
  onBack: () => void;
};

function AgentChanges({ agent, plan }: { agent: ConfigAgent; plan: ConfigPlan }) {
  const changes = plan.changes.filter((change) => agentOfPath(change.path) === agent);
  return (
    <section aria-label={agentName(agent)} className="flex flex-col gap-2">
      <h3 className="m-0 text-xs font-medium">{agentName(agent)}</h3>
      {changes.length === 0 && <p className="m-0 text-xs text-muted">No file changes.</p>}
      {changes.map((change) => (
        <FileChangeCard key={change.path} change={change} />
      ))}
    </section>
  );
}

/** What applying would write, file by file and agent by agent, before anything is written. */
export function ReviewView({ plan, agents, titles, onApply, onBack }: ReviewViewProps) {
  const none = plan.changes.length === 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <p className="m-0 text-sm font-medium">
        {none ? "No files need to change." : `${String(plan.changes.length)} file(s) will change.`}
      </p>
      {allAgents
        .filter((agent) => agents.includes(agent))
        .map((agent) => (
          <AgentChanges key={agent} agent={agent} plan={plan} />
        ))}
      <PlanNotes plan={plan} titles={titles} />
      <div className="flex justify-end gap-2">
        <Button onClick={onBack}>Back to editing</Button>
        <Button variant="primary" onClick={onApply}>
          {none ? "Apply (record the current files)" : "Apply"}
        </Button>
      </div>
    </div>
  );
}
