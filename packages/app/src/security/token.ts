import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TOKEN_BYTES = 32;
const TOKEN_FILE = "api-token";

/** A fresh secret from the operating system's secure random source (32 bytes, base64url). */
export function createToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Saves the secret to `<dataDir>/api-token`, readable by the owner only (0600). The file is
 * written under a temporary name and renamed over the old one, so it is never world-readable.
 * Synchronous on purpose: the server calls it right after binding, before any request is handled.
 */
export function writeTokenFile(options: { dataDir: string; token: string }): void {
  const path = join(options.dataDir, TOKEN_FILE);
  const temporary = `${path}.${String(process.pid)}.tmp`;
  writeFileSync(temporary, options.token, { mode: 0o600 });
  chmodSync(temporary, 0o600);
  renameSync(temporary, path);
}

const digestOf = (text: string): Buffer => createHash("sha256").update(text).digest();

/** True when `given` is the secret. Compares in constant time, whatever the length of `given`. */
export function isToken(options: { given: string | undefined; token: string }): boolean {
  if (options.given === undefined) return false;
  return timingSafeEqual(digestOf(options.given), digestOf(options.token));
}
