import { Button, Dialog } from "../components/index.ts";

export type ArchiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionTitle: string;
  /** Files in the worktree that are not committed yet; archiving would lose them. */
  uncommittedFiles: readonly string[];
  onArchive: (options: { force: boolean }) => void;
};

function Warning({ files }: { files: readonly string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 rounded-lg border border-wait bg-wait-soft p-2.5 text-wait">
        {files.length === 1 ? "1 file has" : `${String(files.length)} files have`} changes that are
        not saved in git. If you archive now, they will be lost.
      </p>
      <ul className="m-0 max-h-40 list-none overflow-y-auto rounded-md bg-code p-2 font-mono text-xs">
        {files.map((file) => (
          <li key={file} className="truncate">
            {file}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Explanation() {
  return (
    <p className="m-0 text-muted">
      The agent stops and its working copy is removed. The branch and the conversation are kept.
    </p>
  );
}

/** Confirms archiving; with unsaved changes it lists the files and offers "Archive anyway". */
export function ArchiveDialog(props: ArchiveDialogProps) {
  const dirty = props.uncommittedFiles.length > 0;
  const close = () => {
    props.onOpenChange(false);
  };
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`Archive “${props.sessionTitle}”?`}
    >
      <div className="flex flex-col gap-3 p-4">
        {dirty ? <Warning files={props.uncommittedFiles} /> : <Explanation />}
        <div className="flex justify-end gap-2">
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              props.onArchive({ force: dirty });
              close();
            }}
          >
            {dirty ? "Archive anyway" : "Archive"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
