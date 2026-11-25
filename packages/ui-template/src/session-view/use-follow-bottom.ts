import {
  type KeyboardEvent,
  type RefObject,
  type UIEvent,
  type WheelEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** Within this many pixels of the end, the user counts as being at the bottom. */
const AT_BOTTOM_PX = 70;

const RELEASING_KEYS = new Set(["PageUp", "ArrowUp", "Home"]);

const distanceFromBottom = (el: HTMLElement): number =>
  el.scrollHeight - el.scrollTop - el.clientHeight;

/** Whether the user has text selected inside `el`: reading it, so the view must not move. */
function hasSelectionIn(el: HTMLElement): boolean {
  const selection = document.getSelection();
  return selection !== null && !selection.isCollapsed && el.contains(selection.anchorNode);
}

type Follow = {
  /** True while new content scrolls into view by itself. */
  following: RefObject<boolean>;
  release: () => void;
  resume: () => void;
  /** New content arrived below a view that was left behind. */
  noteArrival: () => void;
};

/** The follow switch, and `behind`: released, with new content below the view. */
function useFollowState(): { follow: Follow; behind: boolean } {
  const following = useRef(true);
  const [behind, setBehind] = useState(false);
  const follow = useMemo<Follow>(
    () => ({
      following,
      release: () => {
        following.current = false;
      },
      resume: () => {
        following.current = true;
        setBehind(false);
      },
      noteArrival: () => {
        setBehind(true);
      },
    }),
    [],
  );
  return { follow, behind };
}

/**
 * Follows the content: when it (or the view) changes size and the user is following, the view goes
 * to the end by setting `scrollTop` (never `scrollIntoView`, which can scroll the page around it).
 * Starts at the end.
 */
function useStickToEnd(call: {
  scroller: RefObject<HTMLElement | null>;
  content: RefObject<HTMLElement | null>;
  follow: Follow;
}): void {
  const { scroller, content, follow } = call;
  useLayoutEffect(() => {
    const view = scroller.current;
    const inner = content.current;
    if (!view || !inner) return undefined;
    let height = inner.offsetHeight;
    view.scrollTop = view.scrollHeight;
    const observer = new ResizeObserver(() => {
      const grew = inner.offsetHeight > height;
      height = inner.offsetHeight;
      if (follow.following.current) view.scrollTop = view.scrollHeight;
      else if (grew) follow.noteArrival();
    });
    observer.observe(inner);
    observer.observe(view);
    return () => {
      observer.disconnect();
    };
  }, [scroller, content, follow]);
}

/** What to do when the selection in the stream ends: follow again if the user is back at the bottom. */
function endSelection(view: HTMLElement, follow: Follow): void {
  if (distanceFromBottom(view) <= AT_BOTTOM_PX) follow.resume();
}

/** Reacts to the selection changing: a selection in the stream holds the view, clearing it lets go. */
function watchSelection(scroller: RefObject<HTMLElement | null>, follow: Follow) {
  let holding = false;
  return (): void => {
    const view = scroller.current;
    if (!view) return;
    if (hasSelectionIn(view)) {
      holding = true;
      follow.release();
    } else if (holding) {
      holding = false;
      endSelection(view, follow);
    }
  };
}

/** Selecting text in the stream releases the view: whoever reads must not be scrolled away. */
function useReleaseOnSelection(scroller: RefObject<HTMLElement | null>, follow: Follow): void {
  useEffect(() => {
    const onSelection = watchSelection(scroller, follow);
    document.addEventListener("selectionchange", onSelection);
    return () => {
      document.removeEventListener("selectionchange", onSelection);
    };
  }, [scroller, follow]);
}

/** The scroll position the last scroll event saw: moving up, with the content no smaller, is the user. */
type Seen = { top: number; height: number };

function scrollHandlers(follow: Follow) {
  const seen: Seen = { top: 0, height: 0 };
  return {
    onScroll: (event: UIEvent<HTMLElement>): void => {
      const view = event.currentTarget;
      const movedUp = view.scrollTop < seen.top && view.scrollHeight === seen.height;
      seen.top = view.scrollTop;
      seen.height = view.scrollHeight;
      if (movedUp) follow.release();
      else if (distanceFromBottom(view) <= AT_BOTTOM_PX && !hasSelectionIn(view)) follow.resume();
    },
    onWheel: (event: WheelEvent<HTMLElement>): void => {
      if (event.deltaY < 0 && event.currentTarget.scrollTop > 0) follow.release();
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>): void => {
      if (RELEASING_KEYS.has(event.key) && event.currentTarget.scrollTop > 0) follow.release();
    },
  };
}

/**
 * Keeps a scrolling stream at its end while the user is there, and leaves it alone otherwise. The
 * user leaves by scrolling up, selecting text or pressing PageUp, ArrowUp or Home, and comes back
 * by scrolling to the bottom or by `jump`. While away, `behind` says new content has arrived.
 */
export function useFollowBottom() {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const { follow, behind } = useFollowState();
  const handlers = useMemo(() => scrollHandlers(follow), [follow]);
  useStickToEnd({ scroller, content, follow });
  useReleaseOnSelection(scroller, follow);
  const jump = (): void => {
    const view = scroller.current;
    if (view) view.scrollTop = view.scrollHeight;
    follow.resume();
  };
  return { scroller, content, handlers, behind, jump };
}
