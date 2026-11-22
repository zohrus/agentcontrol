import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/index.ts";
import { ChangesTab, type ChangesTabProps } from "./changes-tab.tsx";
import { EditorTab, type EditorTabProps } from "./editor-tab.tsx";
import { OpenInVSCode, vscodeUrl } from "./vscode-link.tsx";

export type ChangesPanelProps = ChangesTabProps & {
  worktreePath: string;
  readOnly: boolean;
  onSave: EditorTabProps["onSave"];
};

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
