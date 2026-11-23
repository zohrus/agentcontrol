import type { LoadedPreview } from "../setup/preview-user.ts";

const header = (page: LoadedPreview, name: string): string => page.headers.get(name) ?? "";

/** The page came with the policy that fences it in: a sandbox with its own origin, no network. */
export function expectPreviewToBeFencedIn(page: LoadedPreview): void {
  const policy = header(page, "content-security-policy");
  const wanted = ["sandbox allow-scripts allow-forms", "connect-src 'none'", "form-action 'none'"];
  for (const directive of wanted) {
    if (!policy.includes(directive)) {
      throw new Error(
        `expected the preview's policy to include "${directive}", but it is: ${policy}`,
      );
    }
  }
  if (policy.includes("allow-same-origin")) {
    throw new Error(
      `expected the preview not to share the app's origin, but its policy is: ${policy}`,
    );
  }
}

/** The page may only load things from its own ticket folder, never from the rest of the app. */
export function expectPreviewToLoadOnlyFromItsOwnFolder(page: LoadedPreview): void {
  const policy = header(page, "content-security-policy");
  const folder = new URL(page.address).pathname.split("/").slice(0, 3).join("/") + "/";
  if (!policy.includes(`${new URL(page.address).origin}${folder}`)) {
    throw new Error(
      `expected the preview to load only from ${folder}, but its policy is: ${policy}`,
    );
  }
}

/** The response is never cached, never sniffed into another type, and leaks no referrer. */
export function expectPreviewToBeInertToTheBrowser(page: LoadedPreview): void {
  const expected = { "x-content-type-options": "nosniff", "cache-control": "no-store" };
  for (const [name, value] of Object.entries(expected)) {
    if (header(page, name) !== value) {
      throw new Error(
        `expected ${name}: ${value} on the preview, but it was "${header(page, name)}"`,
      );
    }
  }
}

/** The page is the file as written: the app added nothing, no token and no script. */
export function expectPreviewToBeExactly(page: LoadedPreview, content: string): void {
  if (page.status !== 200) {
    throw new Error(`expected the preview to load, but the app answered ${String(page.status)}`);
  }
  if (page.text !== content) {
    throw new Error(
      `expected the preview to be exactly ${JSON.stringify(content)}, but it is ${JSON.stringify(page.text)}`,
    );
  }
}

/** The file came back byte for byte, with the content type a browser needs to use it. */
export function expectPreviewToServe(
  page: LoadedPreview,
  expected: { contentType: string; bytes: Uint8Array },
): void {
  if (page.status !== 200) {
    throw new Error(
      `expected ${page.address} to load, but the app answered ${String(page.status)}`,
    );
  }
  if (!header(page, "content-type").startsWith(expected.contentType)) {
    throw new Error(
      `expected content type ${expected.contentType}, but it was "${header(page, "content-type")}"`,
    );
  }
  if (Buffer.compare(page.bytes, expected.bytes) !== 0) {
    throw new Error(`expected ${page.address} to come back byte for byte, but it differs`);
  }
}

/** The app refused to show anything, said so in words, and gave away none of the file. */
export function expectPreviewToBeRefused(
  page: LoadedPreview,
  expected: { status: number; leaking?: string },
): void {
  if (page.status !== expected.status) {
    throw new Error(
      `expected the preview to be refused with ${String(expected.status)}, but the app answered ${String(page.status)}: ${page.text}`,
    );
  }
  if (page.text.length === 0)
    throw new Error("expected the refusal to say why, but it said nothing");
  if (expected.leaking !== undefined && page.text.includes(expected.leaking)) {
    throw new Error(`expected the refusal not to show "${expected.leaking}", but it did`);
  }
}
