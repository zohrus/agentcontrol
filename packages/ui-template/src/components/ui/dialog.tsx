import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn.ts";

type Placement = "center" | "wide" | "right";

const placements: Record<Placement, string> = {
  center:
    "left-1/2 top-1/2 max-h-[90vh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border",
  wide: "left-1/2 top-1/2 h-[min(780px,92vh)] w-[min(1000px,94vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border",
  right: "right-0 top-0 h-full w-[min(520px,100vw)] border-l",
};

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  placement?: Placement;
  children: ReactNode;
};

function CloseButton() {
  return (
    <DialogPrimitive.Close
      aria-label="Close"
      className="rounded-md p-1 text-muted hover:bg-code hover:text-fg"
    >
      <X className="size-4" />
    </DialogPrimitive.Close>
  );
}

function DialogHeader({ title, description }: Pick<DialogProps, "title" | "description">) {
  return (
    <div className="flex items-start gap-2 border-b border-line px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <DialogPrimitive.Title className="m-0 text-sm font-semibold">{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="m-0 text-xs text-muted">
          {description}
        </DialogPrimitive.Description>
      </div>
      <CloseButton />
    </div>
  );
}

/** A modal dialog (or side sheet) that traps focus and closes on Escape. */
export function Dialog({
  open,
  onOpenChange,
  placement = "center",
  children,
  ...header
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border-line bg-surface text-fg shadow-xl",
            placements[placement],
          )}
        >
          <DialogHeader {...header} />
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
