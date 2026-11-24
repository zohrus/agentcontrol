import { ndJsonStream } from "@agentclientprotocol/sdk";
import { createMockAgent } from "./agent.ts";
import { loadScript } from "./script.ts";
import { untilFileExists } from "./steps.ts";

const scriptPath = process.env["MOCK_AGENT_SCRIPT"];
if (!scriptPath) throw new Error("MOCK_AGENT_SCRIPT must point to a mock agent script JSON file");

const script = await loadScript(scriptPath);
if (script.ignoresTheStopSignal) process.on("SIGTERM", () => undefined);
// A process that is slow to boot says nothing until it is up; the relay's `initialize` waits.
if (script.bootsAfterMs !== undefined) await Bun.sleep(script.bootsAfterMs);
if (script.bootsWhenFileExists !== undefined) await untilFileExists(script.bootsWhenFileExists);

const stdout = new WritableStream<Uint8Array>({
  async write(chunk) {
    await Bun.write(Bun.stdout, chunk);
  },
});

const connection = createMockAgent(script).connect(ndJsonStream(stdout, Bun.stdin.stream()));
await connection.closed;
