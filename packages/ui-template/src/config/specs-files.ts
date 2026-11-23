import { given, idOf, kindSpec, needsName, str, valueOf } from "./kind-spec.ts";

const SKILL_FILE = "SKILL.md";

const skillText = (files: readonly { path: string; content: string }[]): string =>
  files.find((file) => file.path === SKILL_FILE)?.content ?? "";

/** A skill is a folder; the form edits its SKILL.md and keeps the other files as they are. */
export const skillSpec = kindSpec(
  "skill",
  {
    label: "Skills",
    noun: "skill",
    fields: [
      { key: "name", label: "Name", control: "text" },
      {
        key: "text",
        label: "SKILL.md",
        control: "area",
        hint: "Starts with a --- header giving the name and description.",
      },
    ],
  },
  {
    empty: { id: "", kind: "skill", name: "", files: [] },
    toForm: (item) => ({ name: item.name, text: skillText(item.files) }),
    build: (form, base) => {
      const error = needsName(form);
      if (error) return { error };
      const others = (base?.files ?? []).filter((file) => file.path !== SKILL_FILE);
      const files = [{ path: SKILL_FILE, content: valueOf(form, "text") }, ...others];
      return { item: { id: idOf(base), kind: "skill", name: valueOf(form, "name").trim(), files } };
    },
    summary: (item) => `${String(item.files.length)} file(s)`,
  },
);

export const commandSpec = kindSpec(
  "command",
  {
    label: "Commands",
    noun: "command",
    fields: [
      { key: "name", label: "Name", control: "text", hint: "What you type after the slash." },
      { key: "description", label: "Description", control: "text" },
      { key: "prompt", label: "Prompt", control: "area" },
    ],
  },
  {
    empty: { id: "", kind: "command", name: "", prompt: "" },
    toForm: (item) => ({
      name: item.name,
      description: str(item.description),
      prompt: item.prompt,
    }),
    build: (form, base) => {
      const error = needsName(form);
      if (error) return { error };
      const named = { name: valueOf(form, "name").trim(), prompt: valueOf(form, "prompt") };
      const description = given("description", valueOf(form, "description").trim());
      return { item: { id: idOf(base), kind: "command", ...named, ...description } };
    },
    summary: (item) => item.description ?? item.prompt.split("\n")[0] ?? "",
  },
);
