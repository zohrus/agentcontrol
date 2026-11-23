import type { RepoInfo, ScopedItem } from "@agentcontrol/protocol";
import { Button, Dialog, Field, inputClass } from "../components/index.ts";
import type { Field as FieldSpec, Kind } from "./kind-spec.ts";
import { GLOBAL, useItemForm } from "./use-item-form.ts";

export type ItemEditorProps = {
  kind: Kind;
  initial?: ScopedItem | undefined;
  repos: readonly RepoInfo[];
  takenIds: ReadonlySet<string>;
  onSave: (item: ScopedItem) => void;
  onCancel: () => void;
};

type ControlProps = { spec: FieldSpec; value: string; onChange: (value: string) => void };

function Control({ spec, value, onChange }: ControlProps) {
  const change = (e: { target: { value: string } }) => {
    onChange(e.target.value);
  };
  if (spec.control === "area") {
    return (
      <textarea rows={4} className={`${inputClass} font-mono`} value={value} onChange={change} />
    );
  }
  if (spec.control === "text")
    return <input className={inputClass} value={value} onChange={change} />;
  return (
    <select className={inputClass} value={value} onChange={change}>
      {spec.options?.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

type ScopeProps = { repos: readonly RepoInfo[]; value: string; onChange: (v: string) => void };

function ScopeField({ repos, value, onChange }: ScopeProps) {
  return (
    <Field label="Where it applies" hint="Everywhere, or only in one repository.">
      <select
        className={inputClass}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      >
        <option value={GLOBAL}>All repositories</option>
        {repos.map((repo) => (
          <option key={repo.repoId} value={repo.path}>
            Only {repo.path}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Buttons({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" variant="primary">
        Save
      </Button>
    </div>
  );
}

type Editor = ReturnType<typeof useItemForm>;

function Fields({ editor }: { editor: Editor }) {
  return editor.spec.fields.map((field) => (
    <Field key={field.key} label={field.label} {...(field.hint && { hint: field.hint })}>
      <Control
        spec={field}
        value={editor.form[field.key] ?? ""}
        onChange={(value) => {
          editor.set(field.key, value);
        }}
      />
    </Field>
  ));
}

/** The form for one MCP server, instruction, rule set, hook, skill, command or variable set. */
export function ItemEditor(props: ItemEditorProps) {
  const editor = useItemForm({ ...props, initial: props.initial });
  const title = `${props.initial ? "Edit" : "Add"} ${editor.spec.noun}`;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onCancel();
      }}
      title={title}
    >
      <form onSubmit={editor.submit} className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
        <Fields editor={editor} />
        <ScopeField repos={props.repos} value={editor.scope} onChange={editor.setScope} />
        {editor.error && (
          <p role="alert" className="m-0 text-xs text-fail">
            {editor.error}
          </p>
        )}
        <Buttons onCancel={props.onCancel} />
      </form>
    </Dialog>
  );
}
