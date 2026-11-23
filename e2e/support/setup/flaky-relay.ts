// A relay command that fails until a marker file exists, then runs the real relay bridge.
// Usage: bun flaky-relay.ts <marker file> <relay main.ts> <bridge flags...>
import { existsSync } from "node:fs";

const [marker, relayMain, ...flags] = process.argv.slice(2);
if (marker === undefined || relayMain === undefined || !existsSync(marker)) process.exit(1);
const bridge = Bun.spawn(["bun", relayMain, ...flags], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(await bridge.exited);
