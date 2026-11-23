import type { FsEntry } from "@agentcontrol/protocol";
import type { SessionId } from "@agentcontrol/sdk";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/index.ts";
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

function PanelTabs({ changes, vscode }: { changes: number; vscode: string }) {
  return (
    <TabsList className="border-b border-line px-2.5 pt-2">
      <TabsTrigger value="changes">Changes {changes}</TabsTrigger>
      <TabsTrigger value="editor">Editor</TabsTrigger>
      <TabsTrigger value="preview">Preview</TabsTrigger>
      <TabsTrigger value="terminal">Terminal</TabsTrigger>
      <OpenInVSCode href={vscode} />
    </TabsList>
  );
}

/** Right-hand panel: Changes, Editor and Preview tabs plus an "Open in VS Code" link. */
export function ChangesPanel(props: ChangesPanelProps) {
  const { diff, selectedPath, worktreePath } = props;
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
      <PanelTabs changes={diff.files.length} vscode={vscodeUrl(worktreePath, selectedPath)} />
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
