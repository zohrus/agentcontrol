# The conversation stream is fluid and never moves what is already shown

Date: 25 Nov 2026. Asked for by the owner after running real Claude Code on a Mac: streaming felt
jerky, and items changed shape or place after they were shown.

## Rules

1. Once shown, content above the streaming tail never moves or changes size because of new data.
   Only the last block of the last item may grow, and only downwards.
2. A status change (pending, running, done, failed, answered) swaps content inside a row of fixed
   height. It never adds or removes lines.
3. Nothing collapses or expands by itself after being shown. Only the user opens or closes things.
4. An item keeps its React key and DOM element for its whole life. No replace-on-upgrade (a single
   tool becoming a group, an outgoing message becoming the history's copy).
5. Text already shown is never restyled. Ambiguous markers at the tail are held back until decided
   (a line-start `#`, `-`, `1.`, a code fence, table rows). Inline markers are auto-closed.
6. The view follows new content only while the user is at the bottom (within about 70 px).
   Scrolling up, selecting text or pressing a key releases it. Coming back to the bottom, or
   "Jump to latest", resumes it.
7. "Working" is one fixed-height row at the end of the stream. When the turn ends it is replaced in
   place by the end-of-turn line of the same height.
8. The header and composer have a fixed height while streaming: truncate, never wrap.

## Owner decisions (25 Nov 2026)

- Releases serve a production build of the UI, not the Vite dev server.
- Text is revealed at a steady pace, never more than about 250 ms behind arrival, and flushed at
  once at turn end, on a permission request and when the tab is hidden. History is shown at once.
- Thinking stays open, capped in height while it streams, and is never collapsed automatically.
- The setup block starts collapsed with the live step in its summary line.
- No word fade-in for now.

## Tests

Browser tests assert the rules as invariants, never timings: an element's top and its DOM identity
do not change while later chunks stream, shown text never gets shorter, and the scroll position is
kept after the user scrolls up.

## No new dependency

`streamdown`, `remend` and `use-stick-to-bottom` were looked at. Each part we need is under about
60 lines of our own code.
