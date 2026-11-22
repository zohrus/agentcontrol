import type { SessionId } from "@agentcontrol/protocol";
import type { ComponentType } from "react";
import { ScrollArea } from "../components/index.ts";
import { groupByWorkspace, isWaiting } from "./group-entries.ts";
import { ListFilters, type SessionFilter } from "./list-filters.tsx";
import { SessionRow } from "./session-row.tsx";
import type { SessionListEntry, SessionRowProps } from "./types.ts";
import { useListKeys } from "./use-list-keys.ts";
import { useSessionFilter } from "./use-session-filter.ts";
import { WorkspaceSection } from "./workspace-group.tsx";

export type SessionListProps = {
  entries: readonly SessionListEntry[];
  selectedId: SessionId | undefined;
  onSelect: (id: SessionId) => void;
  showArchived: boolean;
  onShowArchivedChange: (show: boolean) => void;
  /** Approve or deny from a row that has a single pending permission request. */
  onAnswerPermission?: (sessionId: SessionId, requestId: string, optionId: string) => void;
  /** Slot: replaces the default row. */
  rowComponent?: ComponentType<SessionRowProps>;
};

type RowsProps = SessionListProps & { filter: SessionFilter };

function Rows(props: RowsProps) {
  const Row = props.rowComponent ?? SessionRow;
  const { onAnswerPermission } = props;
  const renderEntry = (entry: SessionListEntry) => (
    <Row
      key={entry.summary.id}
      entry={entry}
      selected={entry.summary.id === props.selectedId}
      onSelect={() => {
        props.onSelect(entry.summary.id);
      }}
      onAnswerPermission={
        onAnswerPermission &&
        ((requestId, optionId) => {
          onAnswerPermission(entry.summary.id, requestId, optionId);
        })
      }
    />
  );
  const shown = props.filter === "inbox" ? props.entries.filter(isWaiting) : props.entries;
  return groupByWorkspace(shown, props.filter === "archived").map((group) => (
    <WorkspaceSection key={group.workspace} group={group} renderEntry={renderEntry} />
  ));
}

/** Sessions grouped by workspace; Inbox, All and Archived filters; j/k keyboard navigation. */
export function SessionList(props: SessionListProps) {
  const keys = useListKeys();
  const { filter, change } = useSessionFilter(props);
  return (
    <div ref={keys.ref} onKeyDown={keys.onKeyDown} className="flex h-full min-h-0 flex-col bg-bg">
      <ListFilters
        filter={filter}
        waiting={props.entries.filter(isWaiting).length}
        onChange={change}
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-2">
          <Rows {...props} filter={filter} />
        </div>
      </ScrollArea>
    </div>
  );
}
