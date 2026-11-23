import {
  RelayName as N,
  type SessionId,
  TerminalClientMessage,
  type TerminalServerMessage,
} from "@agentcontrol/protocol";
import type { Link, TerminalSignal } from "../sync/index.ts";

export interface BridgeOptions {
  link: Link;
  sessionId: SessionId;
  /** Sends a message to the browser. */
  send(message: TerminalServerMessage): void;
  /** Ends the socket, with a WebSocket close code and a short reason. */
  hangUp(code: number, reason: string): void;
}

const CLOSE_NORMAL = 1000;
const CLOSE_POLICY = 1008;
const CLOSE_INTERNAL = 1011;

const LOST = "The connection to the workspace was lost, so the terminal ended.";

function parseFrame(frame: string): TerminalClientMessage | undefined {
  try {
    const checked = TerminalClientMessage.safeParse(JSON.parse(frame));
    return checked.success ? checked.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * One browser's terminal: JSON text frames in and out, relay methods on the workspace's link. The
 * browser's messages are handled one at a time, in order, so input never overtakes `open`.
 */
export class Bridge {
  private terminalId: string | undefined;
  /** What the shell said before `open` was answered, so none of it is lost. */
  private early: TerminalSignal[] = [];
  private stopListening: () => void = () => undefined;
  private closed = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly options: BridgeOptions) {}

  /** Handles one text frame from the browser. */
  receive(frame: string): void {
    const message = parseFrame(frame);
    if (message === undefined) {
      this.options.hangUp(CLOSE_POLICY, "unexpected message");
      return;
    }
    this.queue = this.queue.then(() => this.run(message));
  }

  /** The browser went away: ends the shell and stops listening. */
  close(): void {
    this.closed = true;
    this.stopListening();
    this.endShell();
  }

  private endShell(): void {
    const { terminalId } = this;
    if (terminalId === undefined) return;
    void this.options.link.call(N.terminalClose, { terminalId }).catch(() => undefined);
  }

  private async run(message: TerminalClientMessage): Promise<void> {
    if (this.closed) return;
    try {
      await this.handlers[message.type](message as never);
    } catch (error) {
      this.stopListening();
      const text = error instanceof Error ? error.message : String(error);
      this.options.send({ type: "error", code: "terminal-failed", message: text });
      this.options.hangUp(CLOSE_INTERNAL, "terminal failed");
    }
  }

  private readonly handlers = {
    open: async (message: { cols: number; rows: number }): Promise<void> => {
      if (this.terminalId !== undefined) throw new Error("The terminal is already open.");
      this.stopListening = this.options.link.onTerminal((signal) => {
        this.hear(signal);
      });
      const { sessionId, link } = this.options;
      const opened = await link.call(N.terminalOpen, { sessionId, ...message });
      this.terminalId = opened.terminalId;
      // The socket may have closed while the shell was starting.
      if (this.closed) this.endShell();
      this.early.splice(0).forEach((signal) => {
        this.hear(signal);
      });
    },
    input: async (message: { data: string }): Promise<void> => {
      await this.options.link.call(N.terminalWrite, { terminalId: this.opened(), ...message });
    },
    resize: async (message: { cols: number; rows: number }): Promise<void> => {
      await this.options.link.call(N.terminalResize, { terminalId: this.opened(), ...message });
    },
  };

  private opened(): string {
    if (this.terminalId === undefined) throw new Error("The first message must open the terminal.");
    return this.terminalId;
  }

  /** Passes on what the shell did, as long as it is this socket's terminal. */
  private hear(signal: TerminalSignal): void {
    if (this.terminalId === undefined) {
      this.early.push(signal);
    } else if (signal.type === "lost") {
      this.finish({ type: "error", code: "relay-lost", message: LOST });
    } else if (signal.terminalId === this.terminalId) {
      if (signal.type === "data") this.options.send({ type: "data", data: signal.data });
      else this.finish({ type: "exit", exitCode: signal.exitCode });
    }
  }

  private finish(last: TerminalServerMessage): void {
    this.stopListening();
    this.options.send(last);
    this.options.hangUp(CLOSE_NORMAL, "terminal ended");
  }
}
