import { useState } from "react";
import type { SessionFilter } from "./list-filters.tsx";

function filterOf(showArchived: boolean, inbox: boolean): SessionFilter {
  if (showArchived) return "archived";
  return inbox ? "inbox" : "all";
}

type Archived = { showArchived: boolean; onShowArchivedChange: (show: boolean) => void };

/** The active list filter; Archived is owned by the caller, Inbox is local to the list. */
export function useSessionFilter({ showArchived, onShowArchivedChange }: Archived) {
  const [inbox, setInbox] = useState(false);
  const change = (next: SessionFilter) => {
    setInbox(next === "inbox");
    onShowArchivedChange(next === "archived");
  };
  return { filter: filterOf(showArchived, inbox), change };
}
