import { X } from "lucide-react";
import { useStoreValue } from "../data/index.ts";
import { dismissToast, toasts } from "./toast-store.ts";

/** Shows the messages from `showToast` in the bottom right corner; each can be dismissed. */
export function ToastHost() {
  const list = useStoreValue(toasts, (current) => current);
  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-[60] flex w-[min(380px,92vw)] flex-col gap-2">
      {list.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className="pointer-events-auto flex items-start gap-2 rounded-lg border border-fail bg-surface p-3 text-xs text-fg shadow-lg"
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            aria-label="Dismiss"
            className="rounded p-0.5 text-muted hover:bg-code hover:text-fg"
            onClick={() => {
              dismissToast(toast.id);
            }}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
