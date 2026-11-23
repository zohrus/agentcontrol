import { useState } from "react";
import { Badge, Button } from "../components/index.ts";
import type { UiVersionEntry } from "./types.ts";

const kindLabels: Record<UiVersionEntry["kind"], string> = {
  template: "Default UI",
  change: "Your change",
  update: "Update",
  undo: "Undo",
};

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

type RestoreProps = { entry: UiVersionEntry; onRestore: (commit: string) => void };

type ConfirmProps = { onYes: () => void; onNo: () => void };

function ConfirmRestore({ onYes, onNo }: ConfirmProps) {
  return (
    <span role="group" aria-label="Confirm restore" className="flex items-center gap-1.5 text-xs">
      Restore this version?
      <Button variant="primary" onClick={onYes}>
        Yes, restore
      </Button>
      <Button onClick={onNo}>Cancel</Button>
    </span>
  );
}

/** Restore, then a question: bringing a version back replaces the UI the user is looking at. */
function RestoreButton({ entry, onRestore }: RestoreProps) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    const ask = () => {
      setAsking(true);
    };
    return (
      <Button aria-label={`Restore “${entry.message}”`} onClick={ask}>
        Restore
      </Button>
    );
  }
  const answer = (yes: boolean) => () => {
    setAsking(false);
    if (yes) onRestore(entry.commit);
  };
  return <ConfirmRestore onYes={answer(true)} onNo={answer(false)} />;
}

type RowProps = RestoreProps & { current: boolean };

function VersionRow({ entry, current, onRestore }: RowProps) {
  return (
    <li className="flex items-center gap-2.5 border-b border-line px-4 py-2.5 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{entry.message}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <Badge>{kindLabels[entry.kind]}</Badge>
          {entry.templateVersion && <span>v{entry.templateVersion}</span>}
          <span>{when(entry.createdAt)}</span>
        </span>
      </div>
      {current ? (
        <span className="text-[11px] text-muted">Current</span>
      ) : (
        <RestoreButton entry={entry} onRestore={onRestore} />
      )}
    </li>
  );
}

type Props = { versions: readonly UiVersionEntry[]; onRestore: (commit: string) => void };

/** Every saved version of the UI, newest first, each with a Restore button that asks first. */
export function VersionHistory({ versions, onRestore }: Props) {
  return (
    <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
      {versions.map((entry, index) => (
        <VersionRow key={entry.commit} entry={entry} current={index === 0} onRestore={onRestore} />
      ))}
    </ul>
  );
}
