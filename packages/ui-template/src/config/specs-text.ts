import { PermissionMode } from "@agentcontrol/protocol";
import { linesOf } from "./form-text.ts";
import { idOf, kindSpec, linesText, needsName, valueOf } from "./kind-spec.ts";

export const instructionsSpec = kindSpec(
  "instructions",
  {
    label: "Instructions",
    noun: "instruction",
    fields: [
      { key: "name", label: "Name", control: "text" },
      { key: "text", label: "What the agents should know", control: "area" },
    ],
  },
  {
    empty: { id: "", kind: "instructions", name: "", text: "" },
    toForm: (item) => ({ name: item.name, text: item.text }),
    build: (form, base) => {
      const error = needsName(form);
      if (error) return { error };
      const kept = base?.handWritten === true ? { handWritten: true } : {};
      const named = { name: valueOf(form, "name").trim(), text: valueOf(form, "text") };
      return { item: { id: idOf(base), kind: "instructions", ...named, ...kept } };
    },
    summary: (item) => item.text.split("\n")[0] ?? "",
  },
);

const modes = [
  { value: "", label: "Not set" },
  ...PermissionMode.options.map((value) => ({ value, label: value })),
];

export const permissionSpec = kindSpec(
  "permission",
  {
    label: "Permissions",
    noun: "permission rule set",
    fields: [
      {
        key: "allow",
        label: "Always allow",
        control: "area",
        hint: "One rule per line, for example Bash(git status:*).",
      },
      { key: "deny", label: "Never allow", control: "area", hint: "One rule per line." },
      { key: "mode", label: "Approval mode", control: "select", options: modes },
    ],
  },
  {
    empty: { id: "", kind: "permission", allow: [], deny: [] },
    toForm: (item) => ({
      allow: linesText(item.allow),
      deny: linesText(item.deny),
      mode: item.mode ?? "",
    }),
    build: (form, base) => {
      const mode = PermissionMode.safeParse(valueOf(form, "mode"));
      const allow = linesOf(valueOf(form, "allow"));
      const deny = linesOf(valueOf(form, "deny"));
      const nothing = allow.length + deny.length === 0 && !mode.success;
      if (nothing) return { error: "Add a rule or choose a mode." };
      const chosen = mode.success ? { mode: mode.data } : {};
      return { item: { id: idOf(base), kind: "permission", allow, deny, ...chosen } };
    },
    summary: (item) => `${String(item.allow.length)} allowed, ${String(item.deny.length)} denied`,
  },
);
