import type { DriftReport } from "@agentcontrol/protocol";
import { Button } from "../components/index.ts";

export type DriftEntry = DriftReport["entries"][number];

export type DriftBannerProps = {
  entries: readonly DriftEntry[];
  /** What each item is called, by id. */
  titles: Readonly<Record<string, string>>;
  onKeep: (entry: DriftEntry) => void;
  onOverwrite: (entry: DriftEntry) => void;
};

type EntryProps = Omit<DriftBannerProps, "entries"> & { entry: DriftEntry };

function Choices({ entry, onKeep, onOverwrite }: EntryProps) {
  const edited = entry.status === "drift";
  return (
    <div className="flex gap-1.5">
      {edited && (
        <Button
          onClick={() => {
            onKeep(entry);
          }}
        >
          Keep my manual edit
        </Button>
      )}
      <Button
        onClick={() => {
          onOverwrite(entry);
        }}
      >
        {edited ? "Overwrite" : "Write it again"}
      </Button>
    </div>
  );
}

function Entry(props: EntryProps) {
  const { entry, titles } = props;
  const names = entry.itemIds.map((id) => titles[id] ?? id).join(", ");
  return (
    <li className="flex flex-col gap-1">
      <span>
        <code className="font-mono text-xs">{entry.path}</code>{" "}
        {entry.status === "drift" ? "was edited by hand" : "no longer has"} ({names}).
      </span>
      <Choices {...props} />
    </li>
  );
}

/** Files that no longer match what AgentControl wrote: keep the hand edit, or write over it. */
export function DriftBanner({ entries, ...rest }: DriftBannerProps) {
  if (entries.length === 0) return null;
  return (
    <section
      aria-label="Edited by hand"
      className="m-4 mb-0 flex flex-col gap-2 rounded-lg bg-wait-soft p-3 text-xs"
    >
      <h3 className="m-0 text-xs font-medium text-wait">Edited outside AgentControl</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {entries.map((entry) => (
          <Entry key={entry.path} entry={entry} {...rest} />
        ))}
      </ul>
    </section>
  );
}
