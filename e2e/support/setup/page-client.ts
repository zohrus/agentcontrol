import { type Client, createClient } from "@agentcontrol/sdk";
import type { AppAccess } from "./app.ts";
import { onTestEnd } from "./cleanup.ts";

/** What a browser page offers the SDK: a document whose meta tag holds the secret. */
function installPageWithMeta(token: string): void {
  const meta = { getAttribute: (name: string) => (name === "content" ? token : null) };
  Object.assign(globalThis, { document: { querySelector: () => meta } });
  onTestEnd(() => {
    Reflect.deleteProperty(globalThis, "document");
    return Promise.resolve();
  });
}

/** The SDK as the UI creates it in a page the app served: no token given, only the meta tag. */
export function theUiClientInAPageTheAppServed(app: AppAccess): Client {
  installPageWithMeta(app.token);
  return createClient({ baseUrl: app.baseUrl });
}

/** A client holding an old secret (the app restarted since), and how often it was told so. */
export function aClientHoldingAnOldSecret(app: AppAccess) {
  let told = 0;
  const client = createClient({
    baseUrl: app.baseUrl,
    token: "the-secret-before-the-restart",
    onUnauthorized: () => {
      told += 1;
    },
  });
  return {
    client,
    get timesTold() {
      return told;
    },
  };
}
