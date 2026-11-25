/** Answers the browser's requests for the UI (the page, its scripts and styles). */
export interface UiHandler {
  fetch: (request: Request) => Promise<Response>;
  /** Why the newest UI could not be built, when it could not and an older build is shown. */
  failure?: () => string | undefined;
  close: () => Promise<void>;
}
