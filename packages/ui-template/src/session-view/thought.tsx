import { useLayoutEffect, useRef, useState } from "react";
import { usePacedText } from "./use-paced-text.ts";
import type { ItemOf } from "./view-items.ts";

/** The thinking box shows about six lines (16 px each); the rest scrolls inside it. */
/** The right padding keeps the text clear of the Show more button. */
const box = "whitespace-pre-wrap pr-20 text-xs leading-4";
const capped = "max-h-24 overflow-y-auto";
/** Within this many pixels of its end the box counts as showing its end. */
const AT_END_PX = 4;

const atEnd = (el: HTMLElement): boolean =>
  el.scrollHeight - el.scrollTop - el.clientHeight <= AT_END_PX;

/**
 * The box follows its newest line while the user has not scrolled it up, and says whether it
 * holds more than fits.
 */
function useThoughtBox(call: { text: string; open: boolean }) {
  const element = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [overflows, setOverflows] = useState(false);
  const { text, open } = call;
  useLayoutEffect(() => {
    const el = element.current;
    if (el === null) return;
    if (following.current && !open) el.scrollTop = el.scrollHeight;
    setOverflows(open || el.scrollHeight > el.clientHeight);
  }, [text, open]);
  const onScroll = (): void => {
    if (element.current !== null) following.current = atEnd(element.current);
  };
  return { element, overflows, onScroll };
}

/**
 * The agent's thinking. It stays open: the box is about six lines high, follows the newest line
 * while the thought streams, and keeps that height until the user expands it. While it streams the
 * text is revealed at a pace.
 */
export function Thought({ item }: { item: ItemOf<"thought"> }) {
  const text = usePacedText({
    text: item.text,
    live: item.streaming === true,
    fresh: item.fresh === true,
  });
  const [open, setOpen] = useState(false);
  const { element, overflows, onScroll } = useThoughtBox({ text, open });
  return (
    <div data-testid="thought" className="relative border-l-2 border-line pl-2.5 text-muted">
      <div ref={element} onScroll={onScroll} className={`${box} ${open ? "" : capped}`}>
        <span className="font-medium">Thinking · </span>
        {text}
      </div>
      {overflows && (
        <button
          type="button"
          aria-expanded={open}
          className="absolute right-1 bottom-1 cursor-pointer rounded border border-line bg-surface px-1.5 text-[11px]"
          onClick={() => {
            setOpen(!open);
          }}
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
