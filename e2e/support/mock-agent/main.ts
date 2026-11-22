import { ndJsonStream } from "@agentclientprotocol/sdk";
import { createMockAgent } from "./agent.ts";
import { loadScript } from "./script.ts";

const scriptPath = process.env["MOCK_AGENT_SCRIPT"];
if (!scriptPath) throw new Error("MOCK_AGENT_SCRIPT must point to a mock agent script JSON file");

const stdout = new WritableStream<Uint8Array>({
  async write(chunk) {
    await Bun.write(Bun.stdout, chunk);
  },
});

const connection = createMockAgent(await loadScript(scriptPath)).connect(
  ndJsonStream(stdout, Bun.stdin.stream()),
);
await connection.closed;
