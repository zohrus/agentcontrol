import type { SessionId } from "@agentcontrol/protocol";
import type { ComponentType } from "react";
import { Button, ScrollArea } from "../components/index.ts";
import { groupByWorkspace } from "./group-entries.ts";
import { SessionRow } from "./session-row.tsx";
import type { SessionListEntry, SessionRowProps } from "./types.ts";
import { WorkspaceSection } from "./workspace-group.tsx";

export type SessionListProps = {
  entries: readonly SessionListEntry[];
  selectedId: SessionId | undefined;
  onSelect: (id: SessionId) => void;
  showArchived: boolean;
  onShowArchivedChange: (show: boolean) => void;
  /** Slot: replaces the default row. */
  rowComponent?: ComponentType<SessionRowProps>;
};

function ListHeader({
  showArchived,
  onShowArchivedChange,
}: Pick<SessionListProps, "showArchived" | "onShowArchivedChange">) {
  return (
    <div className="flex items-center justify-between px-2 pt-2">
      <span className="text-xs font-medium">{showArchived ? "Archived" : "Sessions"}</span>
      <Button
        variant="ghost"
        aria-pressed={showArchived}
        onClick={() => {
          onShowArchivedChange(!showArchived);
        }}
      >
        Archived
      </Button>
    </div>
  );
}

/** Sessions grouped by workspace, with an Archived filter toggle. */
export function SessionList(props: SessionListProps) {
  const Row = props.rowComponent ?? SessionRow;
  const renderEntry = (entry: SessionListEntry) => (
    <Row
      key={entry.summary.id}
      entry={entry}
      selected={entry.summary.id === props.selectedId}
      onSelect={() => {
        props.onSelect(entry.summary.id);
      }}
    />
  );
  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <ListHeader
        showArchived={props.showArchived}
        onShowArchivedChange={props.onShowArchivedChange}
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-2">
          {groupByWorkspace(props.entries, props.showArchived).map((group) => (
            <WorkspaceSection key={group.workspace} group={group} renderEntry={renderEntry} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
