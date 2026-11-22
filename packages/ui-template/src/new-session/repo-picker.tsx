import type { RepoInfo } from "@agentcontrol/protocol";
import { useState } from "react";
import { Button, Field, inputClass } from "../components/index.ts";
import type { DraftForm } from "./use-draft.ts";
import { ADD_REPOSITORY } from "./validate.ts";

type AddRowProps = { form: DraftForm; onAdd: (path: string) => void };

function AddRepositoryRow({ form, onAdd }: AddRowProps) {
  const [path, setPath] = useState("");
  const add = () => {
    onAdd(path.trim());
    form.update({ repoPath: path.trim(), branch: undefined });
  };
  return (
    <div className="flex gap-2">
      <input
        aria-label="Repository folder"
        className={inputClass}
        placeholder="/Users/you/code/my-project"
        value={path}
        onChange={(e) => {
          setPath(e.target.value);
        }}
      />
      <Button variant="primary" disabled={path.trim() === ""} onClick={add}>
        Add
      </Button>
    </div>
  );
}

type PickerProps = { repos: readonly RepoInfo[]; form: DraftForm; onAdd: (path: string) => void };

/** Repository choice from the known repos, plus "Add repository…" that takes a folder path. */
export function RepoPicker({ repos, form, onAdd }: PickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <Field label="Repository" error={form.shown.repo}>
        <select
          className={inputClass}
          aria-invalid={form.shown.repo !== undefined}
          value={form.draft.repoPath}
          onBlur={() => {
            form.touch("repo");
          }}
          onChange={(e) => {
            form.update({ repoPath: e.target.value, branch: undefined });
          }}
        >
          {repos.length === 0 && <option value="">No repositories yet</option>}
          {repos.map((repo) => (
            <option key={repo.repoId} value={repo.path}>
              {repo.path}
            </option>
          ))}
          <option value={ADD_REPOSITORY}>Add repository…</option>
        </select>
      </Field>
      {form.draft.repoPath === ADD_REPOSITORY && <AddRepositoryRow form={form} onAdd={onAdd} />}
    </div>
  );
}
