import type { SessionId } from "@agentcontrol/protocol";
import type { Client } from "@agentcontrol/sdk";
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
};

function paneSlots({ selectedId, select, archive, open }: PaneOptions) {
  return {
    sessions: <SessionsPane selectedId={selectedId} onSelect={select} />,
    session: (
      <SessionPane id={selectedId} onNewSession={open("new-session")} onArchive={archive.request} />
    ),
    changes: <ChangesPane key={selectedId} id={selectedId} />,
  };
}

function Workbench() {
  const [selectedId, select] = useSelectedSession();
  const [dialog, setDialog] = useOpenDialog();
  const archive = useArchiveFlow();
  const stats = useStatusStats();
  useOpenSession(selectedId);
  const open: Open = (name) => () => {
    setDialog(name);
  };
  const slots = {
    topBar: topBarSlots(open),
    panes: paneSlots({ selectedId, select, archive, open }),
    statusBar: defaultStatusBarSlots(stats),
  };
  return (
    <>
      <AppShell layout={layout} slots={slots} />
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
