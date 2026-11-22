/** sha256 hex of the text. */
export function hashContent(content: string): string {
  return new Bun.CryptoHasher("sha256").update(content).digest("hex");
}
