import { Button } from "../components/index.ts";
import type { UiUpdate } from "./types.ts";

type Props = {
  update: UiUpdate;
  onUpdate: () => void;
  onKeep: () => void;
  onUndo: () => void;
};

function count(value: number, noun: string): string {
  return `${String(value)} ${noun}${value === 1 ? "" : "s"}`;
}

/** "4 of your changes kept automatically, 1 conflict resolved". */
function mergeSummary(update: Extract<UiUpdate, { phase: "merged" }>): string {
  const kept = `${String(update.keptAutomatically)} of your changes kept automatically`;
  const conflicts =
    update.conflictsResolved === 0
      ? "no conflicts"
      : `${count(update.conflictsResolved, "conflict")} resolved`;
  return `${kept}, ${conflicts}`;
}

function Actions({ update, onUpdate, onKeep, onUndo }: Props) {
  if (update.phase === "available") {
    return (
      <Button variant="primary" onClick={onUpdate}>
        Update
      </Button>
    );
  }
  return (
    <>
      <Button onClick={onUndo}>Undo</Button>
      <Button variant="primary" onClick={onKeep}>
        Keep
      </Button>
    </>
  );
}

function Message({ update }: { update: UiUpdate }) {
  if (update.phase === "available") return <b>Update {update.version} available</b>;
  return (
    <span>
      <b>Updated to {update.version}.</b> {mergeSummary(update)}.
    </span>
  );
}

/** Announces a default-UI update; after the merge, summarises it and asks Keep or Undo. */
export function UpdateBanner(props: Props) {
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 border-b border-line bg-accent-soft px-4 py-2.5 text-xs"
    >
      <div className="min-w-0 flex-1">
        <Message update={props.update} />
      </div>
      <Actions {...props} />
    </div>
  );
}
