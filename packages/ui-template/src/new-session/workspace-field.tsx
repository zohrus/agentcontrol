import { Field, inputClass } from "../components/index.ts";
import type { WorkspaceChoice } from "./types.ts";

type Props = {
  workspaces: readonly WorkspaceChoice[];
  value: string;
  onChange: (id: string) => void;
};

/** Which machine the session runs on; only shown when there is a choice. */
export function WorkspaceField({ workspaces, value, onChange }: Props) {
  if (workspaces.length < 2) return null;
  return (
    <div className="px-4 pt-4">
      <Field label="Workspace" hint="Repositories and agents below are the ones on this machine.">
        <select
          className={inputClass}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id} disabled={!workspace.connected}>
              {workspace.connected ? workspace.label : `${workspace.label} (not connected)`}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
