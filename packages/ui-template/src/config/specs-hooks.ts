import { HookEvent } from "@agentcontrol/protocol";
import { pairsText, parsePairs } from "./form-text.ts";
import { given, idOf, kindSpec, needsName, str, valueOf } from "./kind-spec.ts";

const events = [
  { value: "before-tool", label: "Before a tool runs" },
  { value: "after-edit", label: "After a file is edited" },
  { value: "session-start", label: "When a session starts" },
  { value: "session-stop", label: "When a session stops" },
];

const trimmed = (form: Record<string, string>, key: string): string => valueOf(form, key).trim();

export const hookSpec = kindSpec(
  "hook",
  {
    label: "Hooks",
    noun: "hook",
    fields: [
      { key: "name", label: "Name", control: "text" },
      { key: "event", label: "When", control: "select", options: events },
      {
        key: "matcher",
        label: "Only for tools matching",
        control: "text",
        hint: "Optional, for example Edit|Write.",
      },
      { key: "command", label: "Command to run", control: "text" },
    ],
  },
  {
    empty: { id: "", kind: "hook", name: "", event: "before-tool", command: "" },
    toForm: (item) => ({
      name: item.name,
      event: item.event,
      matcher: str(item.matcher),
      command: item.command,
    }),
    build: (form, base) => {
      const event = HookEvent.safeParse(valueOf(form, "event"));
      const command = trimmed(form, "command");
      const error = needsName(form) ?? (command === "" ? "Enter the command to run." : undefined);
      if (error) return { error };
      if (!event.success) return { error: "Choose when the hook runs." };
      const named = { name: trimmed(form, "name"), event: event.data, command };
      return {
        item: {
          id: idOf(base),
          kind: "hook",
          ...named,
          ...given("matcher", trimmed(form, "matcher")),
        },
      };
    },
    summary: (item) => `${item.event}: ${item.command}`,
  },
);

export const envSpec = kindSpec(
  "env",
  {
    label: "Environment",
    noun: "environment variable set",
    fields: [
      { key: "vars", label: "Variables", control: "area", hint: "NAME=value, one per line." },
    ],
  },
  {
    empty: { id: "", kind: "env", vars: {} },
    toForm: (item) => ({ vars: pairsText(item.vars, "=") }),
    build: (form, base) => {
      const { pairs, bad } = parsePairs(valueOf(form, "vars"), "=");
      if (bad) return { error: `"${bad}" is not NAME=value.` };
      if (Object.keys(pairs).length === 0) return { error: "Add at least one variable." };
      return { item: { id: idOf(base), kind: "env", vars: pairs } };
    },
    summary: (item) => Object.keys(item.vars).join(", "),
  },
);
