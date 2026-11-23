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

/** `bun dev` said that it does not open a browser, and none was asked to open anything. */
export async function expectNoBrowserToOpen(dev: DevCommand): Promise<void> {
  await eventually("expected `bun dev` to say it opens no browser", () =>
    Promise.resolve(
      dev.output().includes("Not opening a browser") ? undefined : `it printed: ${dev.output()}`,
    ),
  );
  const opened = await openedUrl(dev);
  if (opened !== undefined) throw new Error(`expected no browser to open, but it opened ${opened}`);
}
