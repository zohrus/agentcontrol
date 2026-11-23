import type { ConfigItem } from "@agentcontrol/protocol";

export type Kind = ConfigItem["kind"];
export type Of<K extends Kind> = Extract<ConfigItem, { kind: K }>;

/** One input of an item's form. */
export type Field = {
  key: string;
  label: string;
  control: "text" | "area" | "select";
  hint?: string;
  options?: readonly { value: string; label: string }[];
};

export type Form = Record<string, string>;

/** The item a filled form makes, or what is wrong with it in plain words. */
export type Built = { item: ConfigItem } | { error: string };

/** How one kind of item is listed, edited and described. */
export type KindSpec = {
  /** The tab: "MCP servers". */
  label: string;
  /** One of them: "MCP server". */
  noun: string;
  fields: readonly Field[];
  toForm: (item: ConfigItem | undefined) => Form;
  /** `base` is the item being edited, so what the form does not show is kept. */
  build: (form: Form, base: ConfigItem | undefined) => Built;
  /** One line that says what the item is. */
  summary: (item: ConfigItem) => string;
};

type Meta = Pick<KindSpec, "label" | "noun" | "fields">;

type Definition<K extends Kind> = {
  /** What a new item of this kind starts as. */
  empty: Of<K>;
  toForm: (item: Of<K>) => Form;
  build: (form: Form, base: Of<K> | undefined) => Built;
  summary: (item: Of<K>) => string;
};

/** A kind's spec from functions that only ever see items of that kind. */
export function kindSpec<K extends Kind>(kind: K, meta: Meta, def: Definition<K>): KindSpec {
  const own = (item: ConfigItem | undefined): Of<K> | undefined =>
    item?.kind === kind ? (item as Of<K>) : undefined;
  return {
    ...meta,
    toForm: (item) => def.toForm(own(item) ?? def.empty),
    build: (form, base) => def.build(form, own(base)),
    summary: (item) => {
      const mine = own(item);
      return mine ? def.summary(mine) : "";
    },
  };
}

/** The form's value of a field; empty when the form lacks it. */
export const valueOf = (form: Form, key: string): string => form[key] ?? "";

export const needsName = (form: Form): string | undefined =>
  valueOf(form, "name").trim() === "" ? "Give it a name." : undefined;

/** A text field that may be missing, as the empty text. */
export const str = (value: string | undefined): string => value ?? "";

/** A list that may be missing, as one line per entry. */
export const linesText = (value: readonly string[] | undefined): string => (value ?? []).join("\n");

/** The id an edited item keeps; a new one has none yet (the editor gives it one). */
export const idOf = (base: { id: string } | undefined): string => base?.id ?? "";

/** `{ key: value }` when there is a value, nothing otherwise, for spreading into an item. */
export function given<K extends string>(key: K, value: string): Partial<Record<K, string>> {
  return value === "" ? {} : ({ [key]: value } as Partial<Record<K, string>>);
}
