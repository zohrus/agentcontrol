/**
 * What the page inside may do. The flags that would let it reach the app (`allow-same-origin`,
 * `allow-top-navigation`) are never set: the page gets its own empty origin.
 */
const SANDBOX = {
  /** An HTML file: its own scripts and forms work, nothing else. */
  page: "allow-scripts allow-forms",
  /** Rendered Markdown: no scripts at all; links open in a new tab. */
  document: "allow-popups allow-popups-to-escape-sandbox",
} as const;

type Props = { title: string } & (
  | { kind: "page"; src: string }
  | { kind: "document"; srcDoc: string }
);

/** The one iframe that shows previewed content, always sandboxed. */
export function SandboxedFrame(props: Props) {
  const source = props.kind === "page" ? { src: props.src } : { srcDoc: props.srcDoc };
  return (
    <iframe
      data-testid="preview-frame"
      title={props.title}
      sandbox={SANDBOX[props.kind]}
      referrerPolicy="no-referrer"
      className="min-h-0 w-full flex-1 border-0 bg-surface"
      {...source}
    />
  );
}
