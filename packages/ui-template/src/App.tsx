import { SessionId } from "@agentcontrol/protocol";
import type { Client } from "@agentcontrol/sdk";
import { AnalyticsView, withAnalytics } from "./analytics/index.ts";
import {
  DataProvider,
  describeError,
  type SessionRef,
  useOpenSession,
  useStatusStats,
} from "./data/index.ts";
import {
  AppShell,
  defaultStatusBarSlots,
  defaultTopBarSlots,
  parseLayout,
} from "./layout/index.ts";
import layoutJson from "./layout.json";
import {
  AppDialogs,
  ArchiveFlowDialog,
  ChangesPane,
  clearSelectionIf,
  type ChangesRequest,
  type DialogName,
  SessionPane,
  SessionsPane,
  useArchiveFlow,
  useChangesRequest,
  useOpenDialog,
  useSelectedSession,
} from "./panes/index.ts";
import { showToast, ToastHost } from "./toasts/index.ts";

const layout = parseLayout(layoutJson);

type Open = (name: DialogName) => () => void;

const topBarSlots = (open: Open) =>
  defaultTopBarSlots({
    onWorkspaces: open("workspaces"),
    onConfig: open("config"),
    onAnalytics: open("analytics"),
    onModify: open("modify"),
    onNewSession: open("new-session"),
  });

type PaneOptions = {
  selected: SessionRef | undefined;
  select: (ref: SessionRef) => void;
  archive: ReturnType<typeof useArchiveFlow>;
  open: Open;
  /** Set while the Analytics screen is open: how to close it. */
  closeAnalytics: (() => void) | undefined;
  /** The header asks to show the changes; the Changes panel opens its Changes tab each time. */
  changes: ChangesRequest;
};

function paneSlots(options: PaneOptions) {
  const { selected, select, archive, open, closeAnalytics } = options;
  return {
    analytics: closeAnalytics && (
      <AnalyticsView
        onClose={closeAnalytics}
        onOpenSession={(workspaceId, id) => {
          select({ workspaceId, id: SessionId.parse(id) });
        }}
      />
    ),
    sessions: <SessionsPane selected={selected} onSelect={select} />,
    session: (
      <SessionPane
        selected={selected}
        onNewSession={open("new-session")}
        onArchive={archive.request}
        onShowChanges={options.changes.ask}
      />
    ),
    changes: (
      <ChangesPane
        key={selected && `${selected.workspaceId}/${selected.id}`}
        id={selected}
        showChangesTab={options.changes.asked}
      />
    ),
  };
}

/** Which session is open and whether the Analytics screen is; opening a session leaves Analytics. */
function useScreen() {
  const [selected, selectSession] = useSelectedSession();
  const [dialog, setDialog] = useOpenDialog();
  const analyticsOpen = dialog === "analytics";
  const select = (ref: SessionRef): void => {
    selectSession(ref);
    if (analyticsOpen) setDialog(undefined);
  };
  const closeAnalytics = analyticsOpen
    ? () => {
        setDialog(undefined);
      }
    : undefined;
  return { selected, select, dialog, setDialog, closeAnalytics };
}

function Workbench() {
  const { selected, select, dialog, setDialog, closeAnalytics } = useScreen();
  const archive = useArchiveFlow({ selected, select });
  const stats = useStatusStats();
  const changes = useChangesRequest();
  useOpenSession(selected);
  const open: Open = (name) => () => {
    setDialog(name);
  };
  const slots = {
    topBar: topBarSlots(open),
    panes: paneSlots({ selected, select, archive, open, closeAnalytics, changes }),
    statusBar: defaultStatusBarSlots(stats),
  };
  return (
    <>
      <AppShell layout={closeAnalytics ? withAnalytics(layout) : layout} slots={slots} />
      <AppDialogs
        open={dialog}
        onOpenChange={setDialog}
        onStarted={select}
        onStartFailed={clearSelectionIf}
      />
      <ArchiveFlowDialog flow={archive} />
    </>
  );
}

/** The default UI: the live session list, stream and changes of the app behind `client`. */
export function App({ client }: { client: Client }) {
  return (
    <DataProvider
      client={client}
      onError={(error) => {
        showToast(describeError(error));
      }}
    >
      <Workbench />
      <ToastHost />
    </DataProvider>
  );
}
