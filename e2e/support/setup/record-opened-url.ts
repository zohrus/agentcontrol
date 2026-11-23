// Stands in for the browser in tests of `bun dev`: writes the address it was asked to open into a file.
// Usage: bun record-opened-url.ts <file> <url>
import { writeFile } from "node:fs/promises";

const [file, url] = process.argv.slice(2);
if (file === undefined || url === undefined) {
  throw new Error("usage: record-opened-url.ts <file> <url>");
}
await writeFile(file, url);
