import type { ReactNode } from "react";
import { type Block, parseInline, parseMarkdown, type Span } from "./markdown-blocks.ts";

const spanViews: Record<Span["type"], (text: string) => ReactNode> = {
  text: (text) => text,
  code: (text) => <code className="rounded bg-surface px-1 font-mono text-[0.9em]">{text}</code>,
  bold: (text) => <b className="font-semibold">{text}</b>,
};

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((span, index) => (
        <span key={index}>{spanViews[span.type](span.text)}</span>
      ))}
    </>
  );
}

type BlockViews = { [K in Block["type"]]: (block: Extract<Block, { type: K }>) => ReactNode };

const blockViews: BlockViews = {
  heading: (block) => (
    <div className={block.level <= 2 ? "text-[15px] font-semibold" : "font-semibold"}>
      <Inline text={block.text} />
    </div>
  ),
  code: (block) => (
    <pre className="overflow-x-auto rounded-md border border-line bg-surface p-2 font-mono text-xs">
      {block.text}
    </pre>
  ),
  list: (block) => (
    <ul className="list-disc space-y-0.5 pl-5">
      {block.items.map((item, index) => (
        <li key={index}>
          <Inline text={item} />
        </li>
      ))}
    </ul>
  ),
  paragraph: (block) => (
    <p className="m-0 whitespace-pre-wrap">
      <Inline text={block.text} />
    </p>
  ),
};

function BlockView({ block }: { block: Block }) {
  const view = blockViews[block.type] as (block: Block) => ReactNode;
  return view(block);
}

/** An agent's reply: headings, lists, code blocks, `code` and **bold**, nothing else. Never HTML. */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 leading-relaxed">
      {parseMarkdown(text).map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}
