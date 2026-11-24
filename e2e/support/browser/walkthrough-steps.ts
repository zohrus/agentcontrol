import type { Session } from "../setup/app.ts";
import type { Reaction } from "./reaction-expectations.ts";
import type { AppInBrowser } from "./start-app-in-browser.ts";

const roleButton = (app: AppInBrowser, name: string) =>
  app.page.raw.getByRole("button", { name, exact: true });

const dialogShows = (name: string): string =>
  `[...document.querySelectorAll('[role="dialog"]')].some((d) => d.getAttribute("aria-label") === ${JSON.stringify(name)} || d.innerText.includes(${JSON.stringify(name)}))`;

const NO_DIALOG = `document.querySelector('[role="dialog"]') === null`;

/** Opens a dialog from the top bar: the dialog's title is on the page when it is open. */
const opensFromTheTopBar = (app: AppInBrowser, button: string, title: string): Reaction => ({
  action: `Open ${button}`,
  act: () => roleButton(app, button).click(),
  shown: dialogShows(title),
  reads: `open the ${title} dialog`,
});

/** The tab of the right-hand panel is selected, and what it holds is on the page. */
const opensTab = (app: AppInBrowser, tab: RegExp | string, content: string): Reaction => ({
  action: `Open ${String(tab).replaceAll(/[/^]/g, "")} tab`,
  act: () => app.page.raw.getByRole("tab", { name: tab }).click(),
  shown: content,
  reads: `show the ${String(tab)} tab`,
});

const closesWithEscape = (app: AppInBrowser, action: string): Reaction => ({
  action,
  act: () => app.page.raw.keyboard.press("Escape"),
  shown: NO_DIALOG,
  reads: "close the dialog",
});

/** The open session's header names this session. */
const headerNames = (title: string): string =>
  `document.querySelector("header h4")?.innerText === ${JSON.stringify(title)}`;

/** What a user walks through that needs no slow back end, in the order they take it. */
export function walkthroughSteps(call: { app: AppInBrowser; other: Session }): Reaction[] {
  const { app, other } = call;
  return [
    {
      action: "Switch session",
      act: () => app.page.opensSession(other.title),
      shown: headerNames(other.title),
      reads: "open the other session",
    },
    opensTab(app, "Editor", `document.querySelector('[data-testid="file-tree"]') !== null`),
    opensTab(app, "Preview", `document.body.innerText.includes("Preview")`),
    opensTab(app, "Terminal", `document.querySelector('[data-testid="terminal"]') !== null`),
    opensTab(app, /^Changes/, `document.querySelector('[data-testid="diff-viewer"]') !== null`),
    opensFromTheTopBar(app, "Workspaces", "Workspaces"),
    closesWithEscape(app, "Close with Escape"),
    opensFromTheTopBar(app, "Config", "Config"),
    closesWithEscape(app, "Close with Escape (Config)"),
    {
      action: "Open Analytics",
      act: () => roleButton(app, "Analytics").click(),
      shown: `document.querySelector('[data-testid="analytics-view"]') !== null`,
      reads: "open the Analytics screen",
    },
  ];
}
