import { Archive } from "lucide-react";

/** Shown instead of the composer for an archived session: the conversation is read-only. */
export function ArchivedBanner({ archivedAt }: { archivedAt?: string | undefined }) {
  const when = archivedAt ? ` on ${new Date(archivedAt).toLocaleDateString()}` : "";
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-t border-line bg-code px-4 py-3 text-xs text-muted"
    >
      <Archive className="size-4 flex-none" />
      <span>
        This session was archived{when}. You can read it, but not reply. Its branch is kept.
      </span>
    </div>
  );
}
