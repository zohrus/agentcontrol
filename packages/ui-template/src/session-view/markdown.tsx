import { memo, type ReactNode, useMemo } from "react";
import { type Block, parseInline, parseMarkdown, type Span } from "./markdown-blocks.ts";
import { sameBlock } from "./same-block.ts";

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

const cell = "border border-line px-2 py-1 text-left align-top";

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
  table: (block) => (
    <div className="overflow-x-auto">
      <table className="border-collapse text-[13px]">
        <thead>
          <tr>
            {block.header.map((text, index) => (
              <th key={index} className={`${cell} bg-surface font-semibold`}>
                <Inline text={text} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, at) => (
            <tr key={at}>
              {row.map((text, index) => (
                <td key={index} className={cell}>
                  <Inline text={text} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
  paragraph: (block) => (
    <p className="m-0 whitespace-pre-wrap">
      <Inline text={block.text} />
    </p>
  ),
};

/** One block. A block that is finished is not drawn again when the blocks after it change. */
const BlockView = memo(
  function BlockView({ block }: { block: Block }) {
    const view = blockViews[block.type] as (block: Block) => ReactNode;
    return view(block);
  },
  (before, after) => sameBlock(before.block, after.block),
);

type Props = {
  text: string;
  /** False while the reply is still arriving: what could still change its look waits. */
  final?: boolean;
};

/**
 * An agent's reply: headings, lists, tables, code blocks, `code` and **bold**, nothing else.
 * Never HTML. A block is named by where it starts, so it keeps its element while it grows.
 */
export function Markdown({ text, final = true }: Props) {
  const blocks = useMemo(() => parseMarkdown(text, { final }), [text, final]);
  return (
    <div data-markdown="" className="flex flex-col gap-2 leading-relaxed">
      {blocks.map((block) => (
        <BlockView key={block.offset} block={block} />
      ))}
    </div>
  );
}
