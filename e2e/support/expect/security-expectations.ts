import type { SafePageCall } from "../browser/safe-page.ts";
import type { AppAccess } from "../setup/app.ts";
import { apiTokenFileMode, readApiToken } from "../setup/api-token.ts";
import { tokenInPage } from "../setup/browser.ts";
import type { Answer } from "../setup/raw-requests.ts";

/** The app refused the request with this stable error code. */
export function expectRequestRefusedAs(answer: Answer, code: string): void {
  if (answer.code !== code) {
    throw new Error(
      `expected the app to refuse with "${code}", but it answered ${String(answer.status)} ${answer.code ?? answer.body.slice(0, 80)}`,
    );
  }
}

/** The request went through. */
export function expectRequestAccepted(answer: Answer): void {
  if (answer.status !== 200) {
    throw new Error(`expected the app to accept, but it answered ${String(answer.status)}`);
  }
}

/** Nothing in the answer would let another website read it. */
export function expectNoCrossSiteAccessHeaders(answer: Answer): void {
  const allowed = answer.headers.get("access-control-allow-origin");
  if (allowed !== null) {
    throw new Error(`expected no cross-site access headers, but the app allowed "${allowed}"`);
  }
}

/** The answer asks browsers not to sniff its type and not to share it across sites. */
export function expectAnswerToStayWithItsOwnSite(answer: Answer): void {
  const kept =
    answer.headers.get("x-content-type-options") === "nosniff" &&
    answer.headers.get("cross-origin-resource-policy") === "same-origin";
  if (!kept) throw new Error("expected the answer to carry nosniff and same-origin policy headers");
}

/** A page of the app asks browsers not to guess its type. */
export function expectPageNotToBeSniffed(page: Answer): void {
  if (page.headers.get("x-content-type-options") !== "nosniff") {
    throw new Error("expected the page to carry X-Content-Type-Options: nosniff");
  }
}

/** The token file holds a 32-byte secret and only its owner can read or write it. */
export async function expectTokenFileForOwnerOnly(app: { dataDir: string }): Promise<void> {
  const mode = await apiTokenFileMode(app.dataDir);
  const token = await readApiToken(app.dataDir);
  if (mode !== 0o600) {
    throw new Error(`expected the token file to be 0600, but it is ${mode.toString(8)}`);
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new Error("expected the token file to hold a 32-byte base64url secret");
  }
}

/** The page carries the app's secret in its meta tag, and sets no cookie. */
export function expectPageToCarryTheToken(options: { page: Answer; app: AppAccess }): void {
  const { page, app } = options;
  if (tokenInPage(page) !== app.token) {
    throw new Error("expected the page to carry the app's secret in its meta tag");
  }
  if (page.headers.get("set-cookie") !== null)
    throw new Error("expected the page to set no cookie");
}

/** No cookie was set and the answer does not contain the secret anywhere. */
export function expectAnswerToHoldNoSecret(options: { answer: Answer; app: AppAccess }): void {
  const { answer, app } = options;
  const leaked = answer.body.includes(app.token) || answer.headers.get("set-cookie") !== null;
  if (leaked) throw new Error("expected the answer to hold no secret and set no cookie");
}

/** The app's own client, holding the token, gets an answer to a plain request. */
export async function expectOwnClientToReachTheApp(app: AppAccess): Promise<void> {
  const sessions = await app.sdk.sessions.list();
  if (!Array.isArray(sessions)) throw new Error("expected the session list from the app");
}

/** The token on disk is not the one the earlier start wrote. */
export async function expectTokenToHaveChanged(options: {
  dataDir: string;
  before: string;
}): Promise<void> {
  const now = await readApiToken(options.dataDir);
  if (now === options.before) throw new Error("expected a new token after the restart");
}

/** The client was told, once, that the app no longer accepts its secret. */
export function expectClientToBeToldItsSecretIsOld(told: { timesTold: number }): void {
  if (told.timesTold !== 1) {
    throw new Error(
      `expected to be told once that the secret is old, but ${String(told.timesTold)} times`,
    );
  }
}

/** What the app answered to a request for the sessions is a list. */
export function expectSessionListFromTheApp(sessions: unknown): void {
  if (!Array.isArray(sessions)) throw new Error("expected the session list from the app");
}

/** The app accepted what the recovery page's script sent. */
export function expectSafePageCallToBeAccepted(call: SafePageCall): void {
  if (call.status !== 200) {
    throw new Error(
      `expected the app to accept the recovery page's call, but it answered ${String(call.status)}`,
    );
  }
}

/** The socket was closed with WebSocket close code 1008 (policy violation). */
export function expectSocketClosedAsPolicyViolation(code: number): void {
  if (code !== 1008) {
    throw new Error(
      `expected the app to close the socket with 1008, but it closed it with ${String(code)}`,
    );
  }
}
