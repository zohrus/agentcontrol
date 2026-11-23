import type { ApiOutcome } from "../setup/app-attempt.ts";
import type { LoadedPreview } from "../setup/preview-user.ts";
import type { Answer } from "../setup/raw-requests.ts";

/** The app would not hand out a preview address, because the session is gone or archived. */
export function expectNoPreviewAddressToBeGiven(outcome: ApiOutcome<string>): void {
  if (outcome.ok) {
    throw new Error(`expected no preview address for that session, but got ${outcome.value}`);
  }
  if (outcome.code !== "session-not-found") {
    throw new Error(
      `expected the app to say the session was not found, but it said ${outcome.code}`,
    );
  }
}

/** The two addresses carry the same ticket: the session has one ticket at a time. */
export function expectSameTicket(first: string, second: string): void {
  const ticketOf = (address: string): string | undefined => new URL(address).pathname.split("/")[2];
  if (ticketOf(first) !== ticketOf(second)) {
    throw new Error("expected both addresses to carry the same ticket, but they differ");
  }
}

/** The two addresses differ, so a browser that is shown the second one loads the page again. */
export function expectDifferentAddresses(first: string, second: string): void {
  if (first === second) throw new Error(`expected a new address to reload from, but got ${first}`);
}

/** The preview carries neither the app's secret nor the tag the app puts it in. */
export function expectPreviewToHoldNoSecret(page: LoadedPreview, token: string): void {
  if (page.text.includes(token) || page.text.includes("agentcontrol-token")) {
    throw new Error("expected the previewed page to hold no secret of the app, but it does");
  }
}

/** Whether the answer lets a page of another origin (a sandbox) read the file, as wanted. */
export function expectCrossOriginReadAllowed(answer: Answer, wanted: boolean): void {
  const allowed = answer.headers.get("access-control-allow-origin") !== null;
  if (answer.status !== 200 || allowed !== wanted) {
    throw new Error(
      `expected a cross-origin read to be ${wanted ? "allowed" : "refused"}, but the app answered ${String(answer.status)} and it is ${allowed ? "allowed" : "refused"}`,
    );
  }
}

/** The app refused to let a script read the file, and showed none of its content. */
export function expectScriptNotToReadTheFile(answer: Answer, content: string): void {
  if (answer.status !== 403 || answer.body.includes(content)) {
    throw new Error(
      `expected the read by a script to be refused with 403, but the app answered ${String(answer.status)}`,
    );
  }
}

/** A request from inside the preview's sandbox got its file, as the page needs. */
export function expectSandboxedPageToGetItsFile(answer: Answer, content: string): void {
  if (answer.status !== 200 || answer.body !== content) {
    throw new Error(
      `expected the sandboxed page to get its file, but the app answered ${String(answer.status)} ${answer.body.slice(0, 80)}`,
    );
  }
}
