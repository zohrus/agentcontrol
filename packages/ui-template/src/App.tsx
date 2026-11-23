import { SessionId } from "@agentcontrol/protocol";
import type { Client } from "@agentcontrol/sdk";
import { AnalyticsView, withAnalytics } from "./analytics/index.ts";
import { DataProvider, describeError, useOpenSession, useStatusStats } from "./data/index.ts";
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
  type DialogName,
  SessionPane,
  SessionsPane,
  useArchiveFlow,
  useOpenDialog,
  useSelectedSession,
} from "./panes/index.ts";
import { showToast, ToastHost } from "./toasts/index.ts";

const layout = parseLayout(layoutJson);

type Open = (name: DialogName) => () => void;

const topBarSlots = (open: Open) =>
  defaultTopBarSlots({
    onConfig: open("workspace"),
    onAnalytics: open("analytics"),
    onModify: open("modify"),
    onNewSession: open("new-session"),
  });

type PaneOptions = {
  selectedId: SessionId | undefined;
  select: (id: SessionId) => void;
  archive: ReturnType<typeof useArchiveFlow>;
  open: Open;
  /** Set while the Analytics screen is open: how to close it. */
  closeAnalytics: (() => void) | undefined;
};

function paneSlots({ selectedId, select, archive, open, closeAnalytics }: PaneOptions) {
  return {
    analytics: closeAnalytics && (
      <AnalyticsView
        onClose={closeAnalytics}
        onOpenSession={(id) => {
          select(SessionId.parse(id));
        }}
      />
    ),
    sessions: <SessionsPane selectedId={selectedId} onSelect={select} />,
    session: (
      <SessionPane id={selectedId} onNewSession={open("new-session")} onArchive={archive.request} />
    ),
    changes: <ChangesPane key={selectedId} id={selectedId} />,
  };
}

/** Which session is open and whether the Analytics screen is; opening a session leaves Analytics. */
function useScreen() {
  const [selectedId, selectSession] = useSelectedSession();
  const [dialog, setDialog] = useOpenDialog();
  const analyticsOpen = dialog === "analytics";
  const select = (id: SessionId): void => {
    selectSession(id);
    if (analyticsOpen) setDialog(undefined);
  };
  const closeAnalytics = analyticsOpen
    ? () => {
        setDialog(undefined);
      }
    : undefined;
  return { selectedId, select, dialog, setDialog, closeAnalytics };
}

function Workbench() {
  const { selectedId, select, dialog, setDialog, closeAnalytics } = useScreen();
  const archive = useArchiveFlow();
  const stats = useStatusStats();
  useOpenSession(selectedId);
  const open: Open = (name) => () => {
    setDialog(name);
  };
  const slots = {
    topBar: topBarSlots(open),
    panes: paneSlots({
      selectedId,
      select,
      archive,
      open,
      closeAnalytics,
    }),
    statusBar: defaultStatusBarSlots(stats),
  };
  return (
    <>
      <AppShell layout={closeAnalytics ? withAnalytics(layout) : layout} slots={slots} />
      <AppDialogs open={dialog} onOpenChange={setDialog} onStarted={select} />
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
