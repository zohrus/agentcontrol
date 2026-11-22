import { AgentKind } from "@agentcontrol/protocol";
import { Field, inputClass } from "../components/index.ts";
import { agentLabel } from "../session-list/index.ts";
import type { DraftForm } from "./use-draft.ts";

export function BranchField({ form }: { form: DraftForm }) {
  return (
    <Field
      label="Base branch"
      hint="The agent's work starts from this branch."
      error={form.shown.branch}
    >
      <input
        className={inputClass}
        aria-invalid={form.shown.branch !== undefined}
        value={form.draft.baseBranch}
        onBlur={() => {
          form.touch("branch");
        }}
        onChange={(e) => {
          form.update({ branch: e.target.value });
        }}
      />
    </Field>
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

export function PromptField({ form }: { form: DraftForm }) {
  return (
    <Field label="What should the agent do?" error={form.shown.prompt}>
      <textarea
        rows={5}
        className={inputClass}
        aria-invalid={form.shown.prompt !== undefined}
        placeholder="Add per-API-key rate limiting to the public API, with a test."
        value={form.draft.prompt}
        onBlur={() => {
          form.touch("prompt");
        }}
        onChange={(e) => {
          form.update({ prompt: e.target.value });
        }}
      />
    </Field>
  );
}
