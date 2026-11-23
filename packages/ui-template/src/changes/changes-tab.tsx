import type { DiffResult } from "@agentcontrol/protocol";
import { DiffViewer } from "./diff-viewer.tsx";
import { FileList } from "./file-list.tsx";

export type ChangesTabProps = {
  diff: DiffResult;
  selectedPath: string | undefined;
  onSelectPath: (path: string) => void;
  /** Content of the selected file at the base commit. */
  baseContent: string;
  /** Content of the selected file in the worktree. */
  workingContent: string;
  /** Shows a file in the Preview tab. */
  onPreview: (path: string) => void;
};

/** File list from a DiffResult and a diff editor for the selected file. */
export function ChangesTab(props: ChangesTabProps) {
  const { diff, selectedPath, onSelectPath, onPreview, baseContent, workingContent } = props;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FileList
        files={diff.files}
        selectedPath={selectedPath}
        onSelect={onSelectPath}
        onPreview={onPreview}
      />
      {selectedPath ? (
        <DiffViewer path={selectedPath} base={baseContent} working={workingContent} />
      ) : (
        <p className="m-0 p-3 text-xs text-muted">Select a file to see its changes.</p>
      )}
    </div>
  );
}
