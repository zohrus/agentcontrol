import { z } from "zod";

/** The shape of layout.json: which named slots appear where. */
export const Layout = z.object({
  /** Slot names, left to right. "spacer" pushes the following ones to the right. */
  topBar: z.array(z.string()),
  /** Panes, left to right; a pane without `width` takes the remaining space. */
  panes: z
    .array(z.object({ slot: z.string(), width: z.number().int().positive().optional() }))
    .min(1),
  statusBar: z.array(z.string()),
});
export type Layout = z.infer<typeof Layout>;

/** Validates raw layout.json content; throws a readable error when it is wrong. */
export function parseLayout(raw: unknown): Layout {
  return Layout.parse(raw);
}
