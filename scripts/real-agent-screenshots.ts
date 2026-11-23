// Takes two screenshots of the default UI showing a real Claude Code session: one waiting for
// approval with its diff (light), one finished with the whole conversation (dark).
// Usage: bun scripts/real-agent-screenshots.ts [--into docs]
// Needs Claude Code credentials; costs a few cents. Not part of `bun run check`.
import { join } from "node:path";
import { appPageOf } from "../e2e/support/browser/app-page.ts";
import { launchChromium } from "../e2e/support/browser/playwright.ts";
import { answersWith, waitsForApproval, waitsForReply } from "./real-agent/steps.ts";
import { openWorld } from "./real-agent/world.ts";

const folder = process.argv[process.argv.indexOf("--into") + 1] ?? "docs";
const PROMPT =
  "Read greeting.js and README.md. Then use the Edit tool to change the greeting in greeting.js " +
  'from "Hello, world" to "Hello, agent". Do not run shell commands. ' +
  "Finish with a short summary in markdown: a heading, two bullet points and a code block.";

const world = await openWorld({ agent: "claude-code", withUi: true });
const browser = await launchChromium();
const id = await world.startsSession(PROMPT);
const viewport = { width: 1280, height: 900 };

async function openIn(colorScheme: "light" | "dark") {
  const tab = await browser.newPage({ viewport, colorScheme });
  await tab.goto(world.app.baseUrl);
  await tab
    .getByRole("status")
    .filter({ hasText: /^Connected/ })
    .first()
    .waitFor({ timeout: 60_000 });
  await tab.locator("[data-session-item]").first().getByRole("button").first().click();
  await Bun.sleep(1500);
  return appPageOf(tab);
}

const waiting = await waitsForApproval(world, id);
const light = await openIn("light");
await light.takesScreenshot(join(folder, "ui-real-claude-light.png"));
let row = waiting;
while (row.pendingPermissions.length > 0) {
  await answersWith(world, { id, row, kind: "allow_once" });
  await Bun.sleep(1500);
  row = await world.app.sdk.sessions.get(id);
}
await waitsForReply(world, id);
const dark = await openIn("dark");
await dark.takesScreenshot(join(folder, "ui-real-claude-dark.png"));
await browser.close();
await world.closes();
process.exit(0);
