import { eventually } from "../setup/eventually.ts";
import type { AppAccess } from "../setup/app.ts";

/** A first build, with Vite starting up, takes a few seconds on a loaded machine. */
const BUILD_WAIT_MS = 30_000;

const quote = (text: string): string => JSON.stringify(text);

interface ServedUi {
  status: number;
  page: string;
  /** The text of the page's scripts. */
  scripts: string;
}

/** What a browser gets when it opens the app: the page and every script the page loads. */
async function servedUi(app: Pick<AppAccess, "baseUrl">): Promise<ServedUi> {
  const answer = await fetch(`${app.baseUrl}/`);
  const page = await answer.text();
  const sources = [...page.matchAll(/<script[^>]* src="([^"]+)"/g)].map((match) => match[1] ?? "");
  const loaded = await Promise.all(
    sources.map(async (source) => (await fetch(`${app.baseUrl}${source}`)).text()),
  );
  return { status: answer.status, page, scripts: loaded.join("\n") };
}

/** The page the app answers with is a build: its scripts are bundled files, not source modules. */
export async function expectTheAppToServeABuiltUi(app: AppAccess): Promise<void> {
  await eventually(
    "expected the app to serve a built UI",
    async () => {
      const { page, scripts } = await servedUi(app);
      if (page.includes("/@vite/client")) return "its page loads Vite's dev client";
      if (/src="\/src\//.test(page)) return "its page loads the UI's source modules";
      return /src="\/assets\/[^"]+\.js"/.test(page) && scripts !== ""
        ? undefined
        : `its page is ${quote(page.slice(0, 200))}`;
    },
    BUILD_WAIT_MS,
  );
}

/** The UI the app serves shows this text (it is in the page or in a script it loads). */
export function expectTheServedUiToShow(app: AppAccess, text: string): Promise<void> {
  return eventually(
    `expected the served UI to show ${quote(text)}`,
    async () => {
      const { page, scripts } = await servedUi(app);
      return (page + scripts).includes(text) ? undefined : "it does not";
    },
    BUILD_WAIT_MS,
  );
}

/** The UI the app serves does not show this text. */
export async function expectTheServedUiNotToShow(app: AppAccess, text: string): Promise<void> {
  const { page, scripts } = await servedUi(app);
  if ((page + scripts).includes(text)) {
    throw new Error(`expected the served UI not to show ${quote(text)}, but it does`);
  }
}

/** The page tells the user plainly that the last change could not be built, and links the recovery page. */
export function expectThePageToSayTheLastChangeCouldNotBeBuilt(app: AppAccess): Promise<void> {
  return eventually(
    "expected the page to say that the last change could not be built",
    async () => {
      const { page } = await servedUi(app);
      const says = page.includes("could not be built") && page.includes('href="/_safe"');
      return says ? undefined : "it does not";
    },
    BUILD_WAIT_MS,
  );
}

/** The page carries no notice about a build that failed. */
export async function expectThePageToCarryNoBuildNotice(app: AppAccess): Promise<void> {
  const { page } = await servedUi(app);
  if (page.includes("could not be built")) {
    throw new Error("expected the page to carry no notice about a failed build, but it does");
  }
}

/** With no build at all, the page is a plain message (not a blank page) that links the recovery page. */
export function expectAPlainPageThatLinksTheRecoveryPage(app: AppAccess): Promise<void> {
  return eventually(
    "expected a plain page that says the UI could not be built and links the recovery page",
    async () => {
      const { status, page } = await servedUi(app);
      const plain = page.includes("The UI could not be built") && page.includes('href="/_safe"');
      return plain && status === 503 ? undefined : `it answered ${String(status)}: ${page}`;
    },
    BUILD_WAIT_MS,
  );
}

/** The recovery page says the UI could not be built and shows what the build printed. */
export async function expectTheRecoveryPageToExplainTheFailedBuild(app: AppAccess): Promise<void> {
  const page = await (await fetch(`${app.baseUrl}/_safe`)).text();
  if (!page.includes("The UI could not be built") || !page.includes("<pre>")) {
    throw new Error(
      `expected the recovery page to explain the failed build, but it reads: ${page}`,
    );
  }
}

/** The recovery page has no failed build to report. */
export async function expectTheRecoveryPageToReportNoFailedBuild(app: AppAccess): Promise<void> {
  const page = await (await fetch(`${app.baseUrl}/_safe`)).text();
  if (page.includes("The UI could not be built")) {
    throw new Error("expected the recovery page to report no failed build, but it does");
  }
}

/** Right at once (no build is waited for) the app serves the UI that the release shipped built. */
export async function expectTheShippedBuildToBeServedAtOnce(
  app: AppAccess,
  marker: string,
): Promise<void> {
  const { page } = await servedUi(app);
  if (!page.includes(marker)) {
    throw new Error(
      `expected the app to serve the shipped build ${quote(marker)} at once, but it served: ${page}`,
    );
  }
}
