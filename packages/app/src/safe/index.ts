import { Hono } from "hono";
import type { Modify } from "../modify/index.ts";
import { renderSafePage } from "./page.ts";

/**
 * `/_safe`: the recovery page. Served by the app, never by the user's UI, so a broken UI cannot
 * take it away. It shows the Modify state and version history, and can undo, restore and ask.
 */
export function safeRoutes(modify: Modify) {
  return new Hono().get("/", async (c) => {
    await modify.ready().catch(() => undefined);
    const versions = await modify.history().catch(() => []);
    const html = renderSafePage({ state: modify.state(), versions });
    return c.html(html);
  });
}
