import type { FsEntry } from "@agentcontrol/protocol";
import type { SessionId } from "@agentcontrol/sdk";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/index.ts";
import { OpenInBrowserVSCode } from "../ide/index.ts";
import { PreviewTab } from "../preview/index.ts";
import { TerminalTab } from "../terminal/index.ts";
import { ChangesTab, type ChangesTabProps } from "./changes-tab.tsx";
import { EditorTab, type EditorTabProps } from "./editor-tab.tsx";
import { FileTree } from "./file-tree.tsx";
import { OpenInVSCode, vscodeUrl } from "./vscode-link.tsx";

export type ChangesPanelProps = Omit<ChangesTabProps, "onPreview"> & {
  sessionId: SessionId;
  worktreePath: string;
  readOnly: boolean;
  onSave: EditorTabProps["onSave"];
  /** A save was asked for and the app has not answered yet. */
  saving?: boolean | undefined;
  /** Every file of the worktree, offered in the Editor tab. */
  tree: readonly FsEntry[];
  /** Plain-language note about the open file, e.g. that a save was refused. */
  notice?: string | undefined;
};

function Notice({ text }: { text: string }) {
  return (
    <p role="status" className="m-0 border-b border-line bg-wait-soft px-3 py-2 text-xs text-wait">
      {text}
    </p>
  );
}

type EditorContentProps = ChangesPanelProps & { onPreview: (path: string) => void };

/** The Editor tab: every file of the worktree, a note about the open one, and the editor. */
function EditorContent(props: EditorContentProps) {
  const { selectedPath } = props;
  return (
    <>
      <FileTree
        entries={props.tree}
        selectedPath={selectedPath}
        onSelect={props.onSelectPath}
        onPreview={props.onPreview}
      />
      {props.notice && <Notice text={props.notice} />}
      {selectedPath && (
        <EditorTab
          path={selectedPath}
          content={props.workingContent}
          readOnly={props.readOnly}
          saving={props.saving}
          onSave={props.onSave}
        />
      )}
    </>
  );
}

/** The Preview tab of the selected file. */
function PreviewContent(props: ChangesPanelProps) {
  return (
    <PreviewTab
      id={props.sessionId}
      path={props.selectedPath}
      tree={props.tree}
      workingContent={props.workingContent}
      onPick={props.onSelectPath}
    />
  );
}

function PanelTabs({ panel }: { panel: ChangesPanelProps }) {
  const { diff, worktreePath, selectedPath } = panel;
  return (
    <TabsList className="border-b border-line px-2.5 pt-2">
      <TabsTrigger value="changes">Changes {diff.files.length}</TabsTrigger>
      <TabsTrigger value="editor">Editor</TabsTrigger>
      <TabsTrigger value="preview">Preview</TabsTrigger>
      <TabsTrigger value="terminal">Terminal</TabsTrigger>
      <div className="ml-auto flex gap-1.5">
        <OpenInBrowserVSCode id={panel.sessionId} readOnly={panel.readOnly} />
        <OpenInVSCode href={vscodeUrl(worktreePath, selectedPath)} />
      </div>
    </TabsList>
  );
}

/** Right-hand panel: Changes, Editor and Preview tabs plus an "Open in VS Code" link. */
export function ChangesPanel(props: ChangesPanelProps) {
  const [tab, setTab] = useState("changes");
  const onPreview = (path: string): void => {
    props.onSelectPath(path);
    setTab("preview");
  };
  return (
    <Tabs
      value={tab}
      onValueChange={setTab}
      className="flex h-full min-h-0 min-w-0 flex-col bg-surface"
    >
      <PanelTabs panel={props} />
      <TabsContent value="changes">
        <ChangesTab {...props} onPreview={onPreview} />
      </TabsContent>
      <TabsContent value="editor">
        <EditorContent {...props} onPreview={onPreview} />
      </TabsContent>
      <TabsContent value="terminal" forceMount>
        <TerminalTab id={props.sessionId} active={tab === "terminal"} />
      </TabsContent>
      <TabsContent value="preview">
        <PreviewContent {...props} />
      </TabsContent>
    </Tabs>
  );
}
