import { TerminalServerMessage } from "@agentcontrol/protocol";
import type { OpenTerminal, TerminalConnection } from "./terminal-types.ts";

/** The app only ever sends `JSON.stringify` text frames (`app/src/terminal/socket.ts`). */
function parseMessage(data: unknown): TerminalServerMessage | undefined {
  if (typeof data !== "string") return undefined;
  const checked = TerminalServerMessage.safeParse(JSON.parse(data));
  return checked.success ? checked.data : undefined;
}

const REFUSED =
  "The terminal could not connect. The workspace may be offline, or the session archived.";
const LOST = "The connection to AgentControl was lost, so the terminal ended.";
const STALE =
  "This page was opened before AgentControl restarted, so its secret is out of date. Reload the page.";

/** Reports the end of a terminal to the caller once, and nothing after the caller closed it. */
function ending(options: OpenTerminal) {
  let ended = false;
  return {
    end: (exitCode: number | null, problem?: string): void => {
      if (ended) return;
      ended = true;
      if (problem !== undefined) options.onError?.(problem);
      options.onExit(exitCode);
    },
    isOver: (): boolean => ended,
    silence: (): void => {
      ended = true;
    },
  };
}

/** Why a socket that never opened was refused: a stale secret, or something the user can read. */
export async function whyRefused(call: { connection: TerminalConnection; address: string }) {
  const status = await call.connection.statusOf(call.address).catch(() => undefined);
  return status === 401 ? STALE : REFUSED;
}

/** What each message from the app does to the caller's callbacks. */
function handlersOf(call: {
  options: OpenTerminal;
  end: (code: number | null, why?: string) => void;
}) {
  const { options, end } = call;
  return {
    data: (message: { data: string }) => {
      options.onData(message.data);
    },
    exit: (message: { exitCode: number | null }) => {
      end(message.exitCode);
    },
    error: (message: { message: string }) => {
      end(null, message.message);
    },
  };
}

/** Ends the terminal when the socket closes: lost if it had opened, else refused (and why). */
function endWhenClosed(call: {
  socket: WebSocket;
  isOver: () => boolean;
  end: (code: number | null, why?: string) => void;
  refused: () => Promise<string>;
}): void {
  let opened = false;
  call.socket.addEventListener("open", () => {
    opened = true;
  });
  call.socket.addEventListener("close", () => {
    if (call.isOver()) return;
    if (opened) call.end(null, LOST);
    else {
      void call.refused().then((reason) => {
        call.end(null, reason);
      });
    }
  });
}

/** Turns a socket's messages into the caller's callbacks; returns how to silence them. */
export function listen(call: {
  socket: WebSocket;
  options: OpenTerminal;
  refused: () => Promise<string>;
}): () => void {
  const { socket, options, refused } = call;
  const { end, isOver, silence } = ending(options);
  const handlers = handlersOf({ options, end });
  socket.addEventListener("message", (event: MessageEvent) => {
    const message = isOver() ? undefined : parseMessage(event.data);
    if (message) handlers[message.type](message as never);
  });
  endWhenClosed({ socket, isOver, end, refused });
  return silence;
}
