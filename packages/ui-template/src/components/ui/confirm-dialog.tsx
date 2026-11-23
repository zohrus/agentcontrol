import type { ReactNode } from "react";
import { Button } from "./button.tsx";
import { Dialog } from "./dialog.tsx";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** What will happen, in plain words; shown under the title and in the body. */
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** "Are you sure?": says what will happen, and offers the action or Cancel. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { open, title, children, confirmLabel, onConfirm, onCancel } = props;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={title}
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="text-sm">{children}</div>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
