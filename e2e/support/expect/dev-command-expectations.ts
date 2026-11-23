import { readFile } from "node:fs/promises";
import type { DevCommand } from "../setup/dev-command.ts";
import { eventually } from "../setup/eventually.ts";

async function openedUrl(dev: DevCommand): Promise<string | undefined> {
  return readFile(dev.openedFile, "utf8").catch(() => undefined);
}

/** The browser was asked to open the address the app listens on. */
export async function expectBrowserToOpenTheApp(dev: DevCommand): Promise<void> {
  await eventually(`expected the browser to open ${dev.appUrl}`, async () => {
    const opened = await openedUrl(dev);
    return opened === dev.appUrl ? undefined : `it opened ${opened ?? "nothing"}`;
  });
}

/** The browser was not asked to open anything. The app already answers, so an open would be under way. */
export async function expectNoBrowserToOpen(dev: DevCommand): Promise<void> {
  const answer = await fetch(dev.appUrl);
  const opened = await openedUrl(dev);
  if (opened !== undefined) {
    throw new Error(
      `expected no browser to open, but it opened ${opened} (the app answered ${String(answer.status)})`,
    );
  }
}
