import type { Client } from "@agentcontrol/sdk";
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
};

function paneSlots({ selected, select, archive, open }: PaneOptions) {
  return {
    sessions: <SessionsPane selected={selected} onSelect={select} />,
    session: (
      <SessionPane
        selected={selected}
        onNewSession={open("new-session")}
        onArchive={archive.request}
      />
    ),
    changes: (
      <ChangesPane key={selected && `${selected.workspaceId}/${selected.id}`} id={selected} />
    ),
  };
}

function Workbench() {
  const [selected, select] = useSelectedSession();
  const [dialog, setDialog] = useOpenDialog();
  const archive = useArchiveFlow();
  const stats = useStatusStats();
  useOpenSession(selected);
  const open: Open = (name) => () => {
    setDialog(name);
  };
  const slots = {
    topBar: topBarSlots(open),
    panes: paneSlots({ selected, select, archive, open }),
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
