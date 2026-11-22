/** Answers the browser's requests for the UI (the page, its scripts and styles). */
export interface UiHandler {
  fetch: (request: Request) => Promise<Response>;
  close: () => Promise<void>;
}
