import type { RepoSetup } from "@agentcontrol/protocol";
import { useState } from "react";
import { Button, Field, inputClass } from "../components/index.ts";
import { CopyFilesEditor } from "./copy-files-editor.tsx";
import type { RepoWithSetup } from "./types.ts";

type Props = { repo: RepoWithSetup; onSave: (setup: RepoSetup) => void };

function cleaned(setup: RepoSetup): RepoSetup {
  const script = setup.setupScript?.trim();
  const copyFiles = setup.copyFiles.map((f) => f.trim()).filter((f) => f !== "");
  return script ? { copyFiles, setupScript: script } : { copyFiles };
}

function isSame(a: RepoSetup, b: RepoSetup): boolean {
  return JSON.stringify(cleaned(a)) === JSON.stringify(cleaned(b));
}

function ScriptField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field label="Setup script" hint="Runs once in each new worktree, for example npm install.">
      <textarea
        rows={3}
        className={`${inputClass} font-mono`}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </Field>
  );
}

/** Worktree setup for one repository: files to copy and a script to run, with Save. */
export function RepoSetupEditor({ repo, onSave }: Props) {
  const [setup, setSetup] = useState<RepoSetup>(repo.setup);
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line p-3">
      <h4 className="m-0 font-mono text-xs font-medium">{repo.path}</h4>
      <CopyFilesEditor
        files={setup.copyFiles}
        onChange={(copyFiles) => {
          setSetup({ ...setup, copyFiles });
        }}
      />
      <ScriptField
        value={setup.setupScript ?? ""}
        onChange={(setupScript) => {
          setSetup({ ...setup, setupScript });
        }}
      />
      <Button
        variant="primary"
        className="self-end"
        disabled={isSame(setup, repo.setup)}
        onClick={() => {
          onSave(cleaned(setup));
        }}
      >
        Save setup
      </Button>
    </section>
  );
}
