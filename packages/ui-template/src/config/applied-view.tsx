import type { ApplyResult } from "@agentcontrol/protocol";
import { Button, ConfirmDialog, useWorking } from "../components/index.ts";

export type AppliedViewProps = {
  applied: ApplyResult;
  /** Files that changed after the apply; set when an undo was held back for the user to confirm. */
  changedSince: readonly string[];
  onUndo: (force: boolean) => Promise<unknown>;
  /** Declines the undo that was held back; the apply stays as it is. */
  onKeepApply: () => void;
  onDone: () => void;
};

function Written({ paths }: { paths: readonly string[] }) {
  return (
    <>
      <p role="status" className="m-0 text-sm font-medium text-done">
        Applied. {paths.length === 0 ? "No files needed to change." : "These files were written:"}
      </p>
      <ul className="m-0 list-none p-0">
        {paths.map((path) => (
          <li key={path} className="font-mono text-xs">
            {path}
          </li>
        ))}
      </ul>
    </>
  );
}

function ChangedSince(props: Pick<AppliedViewProps, "changedSince" | "onUndo" | "onKeepApply">) {
  return (
    <ConfirmDialog
      open={props.changedSince.length > 0}
      title="Files changed since"
      confirmLabel="Undo anyway"
      onConfirm={() => {
        void props.onUndo(true);
      }}
      onCancel={props.onKeepApply}
    >
      <p className="m-0">
        These files were changed after the apply. Undoing puts them back as they were before it, and
        what was written since is lost:
      </p>
      <ul className="my-2 list-none p-0 font-mono text-xs">
        {props.changedSince.map((path) => (
          <li key={path}>{path}</li>
        ))}
      </ul>
    </ConfirmDialog>
  );
}

/** What the apply wrote, with "Undo this apply"; undoing over later changes asks first. */
export function AppliedView(props: AppliedViewProps) {
  const undoing = useWorking();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <Written paths={props.applied.written} />
      <div className="flex justify-end gap-2">
        <Button
          disabled={undoing.working}
          onClick={() => {
            undoing.run(() => props.onUndo(false));
          }}
        >
          {undoing.working ? "Undoing…" : "Undo this apply"}
        </Button>
        <Button variant="primary" onClick={props.onDone}>
          Done
        </Button>
      </div>
      <ChangedSince {...props} />
    </div>
  );
}
