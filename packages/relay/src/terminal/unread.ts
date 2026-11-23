import type { Client } from "../rpc/index.ts";

/** One piece of a terminal's output waiting in the client's connection: where it ends, how big. */
interface Piece {
  end: number;
  bytes: number;
}

/** What one terminal has sent to its client that the client has not read yet. */
interface TerminalBacklog {
  /** Bytes of this terminal's own output that the client has not read yet. */
  unread(): number;
  /** Runs the send, and remembers how much of the connection it filled. */
  sends(send: () => void): void;
}

/**
 * Counts unread output per terminal. The connection is one stream in order, so a piece is read
 * once the client has read as many bytes as were written up to its end; the connection's own
 * backlog says how many that is. A flood in one terminal then never counts against another.
 */
export function terminalBacklog(client: Client): TerminalBacklog {
  const waiting: Piece[] = [];
  const held = { bytes: 0 };
  const dropRead = (): void => {
    const read = client.written() - client.backlog();
    while (waiting[0] !== undefined && waiting[0].end <= read) {
      held.bytes -= waiting[0].bytes;
      waiting.shift();
    }
  };
  return {
    unread: () => {
      dropRead();
      return held.bytes;
    },
    sends: (send) => {
      const before = client.written();
      send();
      const end = client.written();
      waiting.push({ end, bytes: end - before });
      held.bytes += end - before;
    },
  };
}
