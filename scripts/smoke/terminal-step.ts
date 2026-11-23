// The smoke step that opens a terminal through the compiled app and relay: a pseudo-terminal inside
// a `bun build --compile` binary is the part of the console feature most likely to break.
import type { SmokeApp } from "./app-process.ts";
import { expect } from "./check.ts";
import { runsAMockSession } from "./session-steps.ts";

// The two WebSocket subprotocol names are written out: this script cannot import the packages.
const TERMINAL_PROTOCOL = "agentcontrol.terminal.v1";
const TOKEN_PROTOCOL_PREFIX = "agentcontrol.token.";
const WAIT_MS = 20_000;

interface Frame {
  type: string;
  data?: string;
  message?: string;
}

/** Opens the terminal socket as the SDK does; resolves with what the shell printed once it matches. */
function printedUntil(options: { url: string; token: string; until: RegExp }): Promise<string> {
  const protocols = [TERMINAL_PROTOCOL, `${TOKEN_PROTOCOL_PREFIX}${options.token}`];
  const socket = new WebSocket(options.url, protocols);
  return new Promise((resolve, reject) => {
    let text = "";
    const timer = setTimeout(() => {
      socket.close();
      reject(
        new Error(`the terminal printed ${JSON.stringify(text)}, not ${String(options.until)}`),
      );
    }, WAIT_MS);
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "open", cols: 80, rows: 24 }));
      socket.send(JSON.stringify({ type: "input", data: "echo smoke$((20+22))\n" }));
    });
    socket.addEventListener("message", (event: MessageEvent) => {
      const frame = JSON.parse(String(event.data)) as Frame;
      if (frame.type === "error") reject(new Error(`the terminal failed: ${frame.message ?? ""}`));
      text += frame.data ?? "";
      if (!options.until.test(text)) return;
      clearTimeout(timer);
      socket.close();
      resolve(text);
    });
    socket.addEventListener("error", () => {
      reject(new Error("the app refused the terminal connection"));
    });
  });
}

export async function terminalRuns(app: SmokeApp): Promise<void> {
  const { id } = await runsAMockSession(app);
  const url = `${app.baseUrl.replace(/^http/, "ws")}/api/sessions/${id}/terminal`;
  const printed = await printedUntil({ url, token: app.token, until: /(^|\n|[#$] )smoke42\r?\n/ });
  expect(printed.includes("smoke42"), "the shell did not run the command");
}
