import type { ConfigAgent, ConfigPlan, ScopedItem } from "@agentcontrol/protocol";
import { countOf } from "../status/index.ts";
import { Button, useWorking } from "../components/index.ts";
import { agentName, agentOfPath, allAgents } from "./agents.ts";
import { FileChangeCard } from "./file-change-card.tsx";
import { PlanNotes } from "./plan-notes.tsx";
import { type ReviewScope, repoOfPath, reposOf, scopesOf } from "./review-scopes.ts";

export type ReviewViewProps = {
  plan: ConfigPlan;
  /** The items the review is for; they say which scopes (everywhere, each repository) it covers. */
  items: readonly ScopedItem[];
  /** The agents the review was made for. */
  agents: readonly ConfigAgent[];
  /** What each item is called, by id. */
  titles: Readonly<Record<string, string>>;
  onApply: () => Promise<unknown>;
  onBack: () => void;
};

type ScopeProps = { scope: ReviewScope; plan: ConfigPlan; repos: readonly string[] };

function AgentChanges(props: ScopeProps & { agent: ConfigAgent }) {
  const { agent, scope, plan, repos } = props;
  const changes = plan.changes.filter(
    (change) =>
      agentOfPath(change.path) === agent && repoOfPath(change.path, repos) === scope.repoPath,
  );
  return (
    <section aria-label={agentName(agent)} className="flex flex-col gap-2">
      <h4 className="m-0 text-xs font-medium">{agentName(agent)}</h4>
      {changes.length === 0 && <p className="m-0 text-xs text-muted">No file changes.</p>}
      {changes.map((change) => (
        <FileChangeCard key={change.path} change={change} />
      ))}
    </section>
  );
}

function ScopeChanges(props: ScopeProps & { agents: readonly ConfigAgent[] }) {
  return (
    <section
      aria-label={props.scope.label}
      className="flex flex-col gap-2 rounded-lg border border-line p-3"
    >
      <h3 className="m-0 font-mono text-xs font-medium">{props.scope.label}</h3>
      {allAgents
        .filter((agent) => props.agents.includes(agent))
        .map((agent) => (
          <AgentChanges key={agent} agent={agent} {...props} />
        ))}
    </section>
  );
}

function Footer({
  none,
  onApply,
  onBack,
}: Pick<ReviewViewProps, "onApply" | "onBack"> & { none: boolean }) {
  const applying = useWorking();
  const apply = none ? "Apply (record the current files)" : "Apply";
  return (
    <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
      <Button onClick={onBack} disabled={applying.working}>
        Back to editing
      </Button>
      <Button
        variant="primary"
        disabled={applying.working}
        onClick={() => {
          applying.run(onApply);
        }}
      >
        {applying.working ? "Applying…" : apply}
      </Button>
    </div>
  );
}

/**
 * What applying would write, scope by scope (everywhere, then each repository) and agent by agent,
 * before anything is written. One Apply writes all of it, and one Undo takes all of it back.
 */
export function ReviewView({ plan, items, agents, titles, onApply, onBack }: ReviewViewProps) {
  const none = plan.changes.length === 0;
  const repos = reposOf(items);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <p className="m-0 text-sm font-medium">
          {none
            ? "No files need to change."
            : `${countOf(plan.changes.length, "file")} will change.`}
        </p>
        {scopesOf({ items, changes: plan.changes }).map((scope) => (
          <ScopeChanges key={scope.label} scope={scope} plan={plan} repos={repos} agents={agents} />
        ))}
        <PlanNotes plan={plan} titles={titles} />
      </div>
      <Footer none={none} onApply={onApply} onBack={onBack} />
    </div>
  );
}
