import type { ConfigPlan } from "@agentcontrol/protocol";
import { agentName } from "./agents.ts";

type Props = { plan: ConfigPlan; titles: Readonly<Record<string, string>> };

const placeholderOf = (secret: string): string => `\${secret:${secret}}`;
const nameOf = (titles: Props["titles"], id: string): string => titles[id] ?? id;

/** What the plan cannot do: items an agent does not support, and secrets that are still to fill in. */
export function PlanNotes({ plan, titles }: Props) {
  if (plan.unsupported.length + plan.needsSecret.length === 0) return null;
  return (
    <section aria-label="Not written" className="flex flex-col gap-1 rounded-lg bg-wait-soft p-3">
      <h3 className="m-0 text-xs font-medium text-wait">Not written</h3>
      {plan.unsupported.map((note) => (
        <p key={`${note.itemId}/${note.agent}`} className="m-0 text-xs">
          {nameOf(titles, note.itemId)} is not written for {agentName(note.agent)}: {note.reason}
        </p>
      ))}
      {plan.needsSecret.map((need) => (
        <p key={`${need.itemId}/${need.secret}`} className="m-0 text-xs">
          {nameOf(titles, need.itemId)} needs the secret {need.secret}. It is written as{" "}
          {placeholderOf(need.secret)} for now; fill it in where the agent can read it.
        </p>
      ))}
    </section>
  );
}
