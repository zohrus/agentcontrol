import type { SessionId } from "@agentcontrol/protocol";
import { useState } from "react";
import { ChangesPanel } from "./changes/index.ts";
import { DevDialogs, type DialogName } from "./dev-dialogs.tsx";
import {
  exampleDiff,
  exampleEvents,
  exampleFiles,
  exampleSessions,
  exampleStats,
  exampleUsage,
  exampleWorktreePath,
} from "./dev-fixtures/index.ts";
import {
  AppShell,
  defaultStatusBarSlots,
  defaultTopBarSlots,
  parseLayout,
} from "./layout/index.ts";
import layoutJson from "./layout.json";
import { SessionList } from "./session-list/index.ts";
import { SessionView } from "./session-view/index.ts";

const layout = parseLayout(layoutJson);
const noop = () => undefined;
const firstPath = exampleDiff.files[0]?.path;

type SessionPaneProps = { selectedId: SessionId | undefined; onArchive: () => void };

function SessionPane({ selectedId, onArchive }: SessionPaneProps) {
  const entry = exampleSessions.find((e) => e.summary.id === selectedId);
  if (!entry) return <p className="p-4 text-muted">Select a session.</p>;
  const events = exampleEvents.filter((e) => e.sessionId === entry.summary.id);
  return (
    <SessionView
      summary={entry.summary}
      events={events}
      usage={exampleUsage}
      onSendPrompt={noop}
      onCancel={noop}
      onArchive={onArchive}
      onAnswerPermission={noop}
    />
  );
}

function fileAt(path: string | undefined): { base: string; working: string } {
  return (path && exampleFiles[path]) || { base: "", working: "" };
}

function ChangesPane() {
  const [path, setPath] = useState(firstPath);
  const file = fileAt(path);
  return (
    <ChangesPanel
      diff={exampleDiff}
      selectedPath={path}
      onSelectPath={setPath}
      baseContent={file.base}
      workingContent={file.working}
      worktreePath={exampleWorktreePath}
      readOnly={false}
      onSave={noop}
    />
  );
}

type SessionsPaneProps = { selectedId: SessionId | undefined; onSelect: (id: SessionId) => void };

function SessionsPane({ selectedId, onSelect }: SessionsPaneProps) {
  const [showArchived, setShowArchived] = useState(false);
  return (
    <SessionList
      entries={exampleSessions}
      selectedId={selectedId}
      onSelect={onSelect}
      showArchived={showArchived}
      onShowArchivedChange={setShowArchived}
      onAnswerPermission={noop}
    />
  );
}

export function App() {
  const [selectedId, setSelectedId] = useState(exampleSessions[0]?.summary.id);
  const [dialog, setDialog] = useState<DialogName>();
  const open = (name: DialogName) => () => {
    setDialog(name);
  };
  const actions = {
    onConfig: open("workspace"),
    onAnalytics: noop,
    onModify: open("modify"),
    onNewSession: open("new-session"),
  };
  const panes = {
    sessions: <SessionsPane selectedId={selectedId} onSelect={setSelectedId} />,
    session: <SessionPane selectedId={selectedId} onArchive={open("archive")} />,
    changes: <ChangesPane />,
  };
  const slots = {
    topBar: defaultTopBarSlots(actions),
    panes,
    statusBar: defaultStatusBarSlots(exampleStats),
  };
  return (
    <>
      <AppShell layout={layout} slots={slots} />
      <DevDialogs open={dialog} onOpenChange={setDialog} />
    </>
  );
}
