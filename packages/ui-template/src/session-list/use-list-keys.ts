import { type KeyboardEvent, useRef } from "react";

const steps = new Map([
  ["j", 1],
  ["ArrowDown", 1],
  ["k", -1],
  ["ArrowUp", -1],
]);

function currentIndex(rows: readonly HTMLElement[]): number {
  const active = document.activeElement;
  return rows.findIndex((row) => row.closest("[data-session-item]")?.contains(active));
}

/**
 * Keyboard navigation for the session list: j / ArrowDown and k / ArrowUp move focus between
 * rows, and Enter opens the focused row (it is a button). Rows opt in with `data-session-open`
 * on their button and `data-session-item` on the row.
 */
export function useListKeys() {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: KeyboardEvent) => {
    const step = steps.get(event.key);
    if (step === undefined || !ref.current) return;
    const rows = [...ref.current.querySelectorAll<HTMLElement>("[data-session-open]")];
    const index = Math.min(Math.max(currentIndex(rows) + step, 0), rows.length - 1);
    event.preventDefault();
    rows[index]?.focus();
  };
  return { ref, onKeyDown };
}
