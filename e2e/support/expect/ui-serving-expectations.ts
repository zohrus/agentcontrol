import { BUILT_UI_MARKER } from "../setup/built-ui.ts";

async function answerAt(baseUrl: string, path: string): Promise<{ status: number; body: string }> {
  const answer = await fetch(`${baseUrl}${path}`);
  return { status: answer.status, body: await answer.text() };
}

/** The app answers this address with the UI's page. */
export async function expectAddressToServeTheUi(baseUrl: string, path: string): Promise<void> {
  const { status, body } = await answerAt(baseUrl, path);
  if (status !== 200 || !body.includes(BUILT_UI_MARKER)) {
    throw new Error(`expected ${path} to serve the UI page, but it answered ${String(status)}`);
  }
}

/** The app answers this address with a plain "not found", not the UI's page. */
export async function expectAddressNotToBeTheUi(baseUrl: string, path: string): Promise<void> {
  const { status, body } = await answerAt(baseUrl, path);
  if (status !== 404 || body.includes(BUILT_UI_MARKER)) {
    throw new Error(
      `expected ${path} to answer 404 without the UI page, but it answered ${String(status)}`,
    );
  }
}

/** The app serves this file of the built UI as it is. */
export async function expectAddressToServeFile(call: {
  baseUrl: string;
  path: string;
  content: string;
}): Promise<void> {
  const { status, body } = await answerAt(call.baseUrl, call.path);
  if (status !== 200 || body !== call.content) {
    throw new Error(
      `expected ${call.path} to serve ${JSON.stringify(call.content)}, but got ${String(status)}`,
    );
  }
}
