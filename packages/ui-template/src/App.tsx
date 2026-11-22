import type { SessionId } from "@agentcontrol/protocol";
import { useState } from "react";
import { ChangesPanel } from "./changes/index.ts";
import {
  exampleDiff,
  exampleEvents,
  exampleFiles,
  exampleSessions,
  exampleStats,
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

function SessionPane({ selectedId }: { selectedId: SessionId | undefined }) {
  const entry = exampleSessions.find((e) => e.summary.id === selectedId);
  if (!entry) return <p className="p-4 text-muted">Select a session.</p>;
  const events = exampleEvents.filter((e) => e.sessionId === entry.summary.id);
  return (
    <SessionView
      summary={entry.summary}
      events={events}
      onSendPrompt={noop}
      onCancel={noop}
      onArchive={noop}
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

export function App() {
  const [selectedId, setSelectedId] = useState(exampleSessions[0]?.summary.id);
  const [showArchived, setShowArchived] = useState(false);
  const sessions = (
    <SessionList
      entries={exampleSessions}
      selectedId={selectedId}
      onSelect={setSelectedId}
      showArchived={showArchived}
      onShowArchivedChange={setShowArchived}
    />
  );
  const actions = { onConfig: noop, onAnalytics: noop, onModify: noop, onNewSession: noop };
  const panes = {
    sessions,
    session: <SessionPane selectedId={selectedId} />,
    changes: <ChangesPane />,
  };
  const topBar = defaultTopBarSlots(actions);
  const statusBar = defaultStatusBarSlots(exampleStats);
  return <AppShell layout={layout} slots={{ topBar, panes, statusBar }} />;
}
