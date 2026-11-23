import type { FsEntry } from "@agentcontrol/protocol";
import type { SessionId } from "@agentcontrol/sdk";
import { useMemo, useState } from "react";
import { Button } from "../components/index.ts";
import { previewKindOf } from "./kind.ts";
import { markdownDocument } from "./markdown.ts";
import { PreviewBar } from "./preview-bar.tsx";
import { PreviewPicker } from "./preview-picker.tsx";
import { SandboxedFrame } from "./sandboxed-frame.tsx";
import { type PreviewAddress, useChangesToPage, usePreviewAddress } from "./use-preview.ts";

export type PreviewTabProps = {
  id: SessionId;
  /** The file selected in the Changes or Editor tab, if any. */
  path: string | undefined;
  /** Every file of the worktree, offered when the selected one cannot be previewed. */
  tree: readonly FsEntry[];
  /** The selected file's current text, which Markdown is drawn from. */
  workingContent: string;
  onPick: (path: string) => void;
};

/** Where relative links of a Markdown file point (its folder in the preview), and which load this is. */
function anchorOf(url: string): { base: string; version: string } {
  const address = new URL(url, location.href);
  return { base: new URL("./", address).href, version: address.searchParams.get("v") ?? "" };
}

function Problem({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="status" className="flex flex-col items-start gap-2 p-3 text-xs text-wait">
      <p className="m-0">{message}</p>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  );
}

type PageProps = { path: string; address: Extract<PreviewAddress, { state: "ready" }> };

function Page({ path, address, source }: PageProps & { source: string | undefined }) {
  const document = useMemo(
    () => (source === undefined ? "" : markdownDocument({ source, ...anchorOf(address.url) })),
    [source, address.url],
  );
  if (source === undefined)
    return <SandboxedFrame kind="page" title={`Preview of ${path}`} src={address.url} />;
  return <SandboxedFrame kind="document" title={`Preview of ${path}`} srcDoc={document} />;
}

function PreviewOfFile(props: PreviewTabProps & { path: string }) {
  const { id, path } = props;
  const [reloads, setReloads] = useState(0);
  const changes = useChangesToPage({ id, path });
  const address = usePreviewAddress({ id, path, version: changes + reloads });
  const reload = (): void => {
    setReloads((count) => count + 1);
  };
  if (address.state === "failed") return <Problem message={address.message} onRetry={reload} />;
  if (address.state === "loading")
    return <p className="m-0 p-3 text-xs text-muted">Loading the preview…</p>;
  const markdown = previewKindOf(path) === "markdown";
  return (
    <>
      <PreviewBar path={path} onReload={reload} openUrl={markdown ? undefined : address.url} />
      <Page path={path} address={address} source={markdown ? props.workingContent : undefined} />
    </>
  );
}

/** The Preview tab: an HTML file as a page, or a Markdown file as a document, in a sandbox. */
export function PreviewTab(props: PreviewTabProps) {
  const { id, path } = props;
  if (path === undefined) {
    return (
      <PreviewPicker tree={props.tree} onPick={props.onPick} intro="Pick a page to preview." />
    );
  }
  if (previewKindOf(path) === undefined) {
    const intro = `${path} is not an HTML or Markdown file, so it cannot be previewed.`;
    return <PreviewPicker tree={props.tree} onPick={props.onPick} intro={intro} />;
  }
  return <PreviewOfFile key={`${id}:${path}`} {...props} path={path} />;
}
