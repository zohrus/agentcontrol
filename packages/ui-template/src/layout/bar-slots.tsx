import type { ReactNode } from "react";

export type SlotMap = Record<string, ReactNode>;

/** Renders the named slots in order; "spacer" is built in, unknown names render nothing. */
export function SlotRow({ names, slots }: { names: readonly string[]; slots: SlotMap }) {
  return names.map((name, index) =>
    name === "spacer" ? (
      <span key={`${name}-${String(index)}`} className="flex-1" />
    ) : (
      <div key={`${name}-${String(index)}`} className="contents">
        {slots[name]}
      </div>
    ),
  );
}
