import type { FsEntry } from "@agentcontrol/protocol";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/index.ts";
import { ChangesTab, type ChangesTabProps } from "./changes-tab.tsx";
import { EditorTab, type EditorTabProps } from "./editor-tab.tsx";
import { FileTree } from "./file-tree.tsx";
import { OpenInVSCode, vscodeUrl } from "./vscode-link.tsx";

export type ChangesPanelProps = ChangesTabProps & {
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

/** Right-hand panel: Changes and Editor tabs plus an "Open in VS Code" link. */
export function ChangesPanel(props: ChangesPanelProps) {
  const { diff, selectedPath, worktreePath } = props;
  return (
    <Tabs defaultValue="changes" className="flex h-full min-h-0 min-w-0 flex-col bg-surface">
      <TabsList className="border-b border-line px-2.5 pt-2">
        <TabsTrigger value="changes">Changes {diff.files.length}</TabsTrigger>
        <TabsTrigger value="editor">Editor</TabsTrigger>
        <OpenInVSCode href={vscodeUrl(worktreePath, selectedPath)} />
      </TabsList>
      <TabsContent value="changes">
        <ChangesTab {...props} />
      </TabsContent>
      <TabsContent value="editor">
        <FileTree entries={props.tree} selectedPath={selectedPath} onSelect={props.onSelectPath} />
        {props.notice && <Notice text={props.notice} />}
        {selectedPath && (
          <EditorTab
            path={selectedPath}
            content={props.workingContent}
            readOnly={props.readOnly}
            onSave={props.onSave}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
