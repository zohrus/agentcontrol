import { Lock } from "lucide-react";

/** Shown instead of the composer when the session's workspace cannot take commands. */
export function ReadOnlyBanner({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-t border-line bg-code px-4 py-3 text-xs text-muted"
    >
      <Lock className="size-4 flex-none" />
      <span>{text}</span>
    </div>
  );
}
