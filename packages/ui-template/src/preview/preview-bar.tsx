import { ExternalLink, RotateCw } from "lucide-react";
import { Button } from "../components/index.ts";

type Props = {
  path: string;
  onReload: () => void;
  /** Where the page can be opened on its own; absent for content the app draws itself. */
  openUrl: string | undefined;
};

/** The file being previewed, with a Reload button and, for web pages, an "Open in new tab" link. */
export function PreviewBar({ path, onReload, openUrl }: Props) {
  return (
    <div className="flex items-center gap-1.5 border-b border-line px-3 py-1.5">
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">{path}</span>
      <Button onClick={onReload} className="px-2 py-0.5 text-[11px]">
        <RotateCw size={12} aria-hidden /> Reload
      </Button>
      {openUrl !== undefined && (
        <Button asChild className="px-2 py-0.5 text-[11px]">
          <a href={openUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={12} aria-hidden /> Open in new tab
          </a>
        </Button>
      )}
    </div>
  );
}
