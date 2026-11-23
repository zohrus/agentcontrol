import { eventually } from "../setup/eventually.ts";

const RESTART_WAIT_MS = 30_000;

/** The app answers its root address with the UI page, however many times the UI server died. */
export async function expectUiToBeServedAgain(app: { baseUrl: string }): Promise<void> {
  await eventually(
    "expected the app to serve the UI page again after its UI server was killed",
    async () => {
      const answer = await fetch(`${app.baseUrl}/`).catch(() => undefined);
      if (answer === undefined) return "the app did not answer";
      const page = await answer.text();
      return answer.status === 200 && page.includes('<div id="root">')
        ? undefined
        : `it answered ${String(answer.status)}: ${page.slice(0, 80)}`;
    },
    RESTART_WAIT_MS,
  );
}
