import type { Layout } from "../layout/index.ts";

/**
 * The layout while the Analytics screen is open: the session list stays where the layout puts it
 * (so a session can still be opened), and the screen takes all the room that was the session and
 * its changes.
 */
export function withAnalytics(layout: Layout): Layout {
  const list = layout.panes.find((pane) => pane.slot === "sessions");
  return { ...layout, panes: [...(list ? [list] : []), { slot: "analytics" }] };
}
