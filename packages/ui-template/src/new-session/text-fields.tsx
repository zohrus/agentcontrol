import { AgentKind } from "@agentcontrol/protocol";
import { Field, inputClass } from "../components/index.ts";
import { agentLabel } from "../session-list/index.ts";
import type { DraftForm } from "./use-draft.ts";

/** The optional base branch, folded away: by default a session starts from the remote's trunk. */
export function BranchField({ form, trunk }: { form: DraftForm; trunk: string }) {
  return (
    <details className="text-xs" open={form.shown.branch === undefined ? undefined : true}>
      <summary className="cursor-pointer font-medium">Advanced</summary>
      <div className="pt-2">
        <Field
          label="Base branch (optional)"
          hint={`Starts from the latest ${trunk} on the remote. Change it only to start from another branch.`}
          error={form.shown.branch}
        >
          <input
            className={inputClass}
            aria-invalid={form.shown.branch !== undefined}
            placeholder={`origin/${trunk}`}
            value={form.draft.baseBranch}
            onBlur={() => {
              form.touch("branch");
            }}
            onChange={(e) => {
              form.update({ branch: e.target.value });
            }}
          />
        </Field>
      </div>
    </details>
  );
}

export function AgentField({ form, agents }: { form: DraftForm; agents: readonly AgentKind[] }) {
  return (
    <Field label="Agent" error={form.shown.agent}>
      <select
        className={inputClass}
        value={form.draft.agent}
        disabled={agents.length === 0}
        onChange={(e) => {
          const parsed = AgentKind.safeParse(e.target.value);
          if (parsed.success) form.update({ agent: parsed.data });
        }}
      >
        {agents.length === 0 && <option value="">No agent available</option>}
        {agents.map((agent) => (
          <option key={agent} value={agent}>
            {agentLabel(agent)}
          </option>
        ))}
      </select>
    </Field>
  );
}
