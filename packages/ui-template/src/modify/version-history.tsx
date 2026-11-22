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

type RowProps = { entry: UiVersionEntry; current: boolean; onRestore: (commit: string) => void };

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
        <Button
          aria-label={`Restore “${entry.message}”`}
          onClick={() => {
            onRestore(entry.commit);
          }}
        >
          Restore
        </Button>
      )}
    </li>
  );
}

type Props = { versions: readonly UiVersionEntry[]; onRestore: (commit: string) => void };

/** Every saved version of the UI, newest first, each with a Restore button. */
export function VersionHistory({ versions, onRestore }: Props) {
  return (
    <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
      {versions.map((entry, index) => (
        <VersionRow key={entry.commit} entry={entry} current={index === 0} onRestore={onRestore} />
      ))}
    </ul>
  );
}
