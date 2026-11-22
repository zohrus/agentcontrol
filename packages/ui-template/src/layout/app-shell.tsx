import type { CSSProperties } from "react";
import { SlotRow, type SlotMap } from "./bar-slots.tsx";
import type { Layout } from "./layout-schema.ts";

export type LayoutSlots = {
  topBar: SlotMap;
  panes: SlotMap;
  statusBar: SlotMap;
};

type Pane = Layout["panes"][number];

function paneStyle({ width }: Pane): CSSProperties | undefined {
  return width ? { width, flex: "none" } : undefined;
}

function Panes({ panes, slots }: { panes: Layout["panes"]; slots: SlotMap }) {
  return (
    <div className="flex min-h-0 flex-1">
      {panes.map((pane, index) => (
        <div
          key={`${pane.slot}-${String(index)}`}
          style={paneStyle(pane)}
          className="min-h-0 min-w-0 flex-1 border-r border-line last:border-r-0"
        >
          {slots[pane.slot]}
        </div>
      ))}
    </div>
  );
}

/** The app shell: top bar, panes and status bar, arranged by `layout` and filled from `slots`. */
export function AppShell({ layout, slots }: { layout: Layout; slots: LayoutSlots }) {
  return (
    <div className="flex h-full flex-col bg-bg text-fg">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-3.5 py-2.5">
        <SlotRow names={layout.topBar} slots={slots.topBar} />
      </div>
      <Panes panes={layout.panes} slots={slots.panes} />
      <div className="flex gap-4 border-t border-line bg-bg px-3.5 py-1.5 font-mono text-[11px] text-muted">
        <SlotRow names={layout.statusBar} slots={slots.statusBar} />
      </div>
    </div>
  );
}
