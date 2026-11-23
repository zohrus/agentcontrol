import { startAppWithEmptyHome } from "./config-app.ts";
import { mcpServer } from "./config-items.ts";

/** A home with a Claude Code file the user wrote, and an MCP server the user applied on top of it. */
export async function startAppWithAnAppliedServerOverTheUsersFile() {
  const app = await startAppWithEmptyHome();
  await app.home.has(".claude.json", '{\n  "theme": "dark"\n}\n');
  const filesBefore = await app.home.snapshot();
  await app.user.setsUp([mcpServer({ name: "search", command: "bunx" })]);
  const applied = await app.user.reviewsAndAppliesThePlan();
  return { app, filesBefore, applied };
}
