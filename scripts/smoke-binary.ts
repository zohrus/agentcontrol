// Runs a compiled relay binary for real: daemon on a temp data folder, `--stdio` bridge,
// a `relay/hello` round trip, then `stop`.
// Usage: bun scripts/smoke-binary.ts <relay-binary> [--autostart]
// With --autostart the daemon is not started here: the bridge must start it by itself, which is
// what the app relies on.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";

const HelloReply = z.object({ result: z.object({ relayVersion: z.string() }) });
const binary = resolve(process.argv[2] ?? "");
const autostart = process.argv.includes("--autostart");
const dataDir = mkdtempSync(join(tmpdir(), "ac-smoke-"));
const flags = ["--data-dir", dataDir];

function fail(message: string): never {
  console.error(`smoke FAILED: ${message}`);
  Bun.spawnSync([binary, "stop", ...flags]);
  rmSync(dataDir, { recursive: true, force: true });
  process.exit(1);
}

async function waitFor(what: string, done: () => boolean): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (!done()) {
    if (Date.now() > deadline) fail(`timed out waiting for ${what}`);
    await Bun.sleep(50);
  }
}

async function hello(): Promise<string> {
  const bridge = Bun.spawn([binary, "--stdio", ...flags], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
  });
  void bridge.stdin.write(
    '{"jsonrpc":"2.0","id":1,"method":"relay/hello","params":{"clientVersion":"smoke"}}\n',
  );
  await bridge.stdin.flush();
  let text = "";
  for await (const chunk of bridge.stdout) {
    text += new TextDecoder().decode(chunk);
    if (text.includes("\n")) break;
  }
  bridge.kill();
  return text.split("\n")[0] ?? "";
}

if (!existsSync(binary)) fail(`no binary at ${binary}`);
if (!autostart) {
  Bun.spawn([binary, "daemon", ...flags], { stdio: ["ignore", "ignore", "inherit"] }).unref();
  await waitFor("the relay socket", () => existsSync(join(dataDir, "relay.sock")));
}
const line = await Promise.race([hello(), Bun.sleep(20_000).then(() => "")]);
const reply = HelloReply.safeParse(line === "" ? undefined : JSON.parse(line));
if (!reply.success) fail(`relay/hello answered ${line === "" ? "nothing" : line}`);
console.log(`relay/hello answered: relay ${reply.data.result.relayVersion}`);

// Async, so this process can reap the daemon (its child in the default mode) while stop waits.
await Bun.spawn([binary, "stop", ...flags]).exited;
await waitFor("the daemon to stop", () => !existsSync(join(dataDir, "relay.pid")));
rmSync(dataDir, { recursive: true, force: true });
console.log("smoke passed");
process.exit(0);
