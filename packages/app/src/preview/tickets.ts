import type { SessionId } from "@agentcontrol/protocol";

const HOUR_MS = 60 * 60 * 1000;
const TICKET_BYTES = 24;

/** Who may load a session's files in a preview, without the bearer header an iframe cannot send. */
export interface Previews {
  /** The ticket for this session (the same one while it lives): a random secret, for that session only. */
  ticketFor(sessionId: SessionId): string;
  /** The session a ticket belongs to, or undefined when it is unknown or has expired. */
  sessionOf(ticket: string): SessionId | undefined;
  /** Makes the ticket useless at once (the session was archived). */
  revoke(ticket: string): void;
}

export interface PreviewOptions {
  /** How long a ticket stays valid after its last use; an hour by default. */
  lifetimeMs?: number;
  /** The clock, in milliseconds; the real one by default. */
  now?: () => number;
}

interface Entry {
  sessionId: SessionId;
  expiresAt: number;
}

const newTicket = (): string =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(TICKET_BYTES))).toString("base64url");

/** The tickets in force, and which one each session holds (one at a time). */
function ticketTable() {
  const entries = new Map<string, Entry>();
  const ticketOfSession = new Map<SessionId, string>();
  return {
    entry: (ticket: string) => entries.get(ticket),
    ticketOf: (sessionId: SessionId) => ticketOfSession.get(sessionId),
    add: (ticket: string, entry: Entry): void => {
      entries.set(ticket, entry);
      ticketOfSession.set(entry.sessionId, ticket);
    },
    drop: (ticket: string): void => {
      const entry = entries.get(ticket);
      entries.delete(ticket);
      if (entry !== undefined && ticketOfSession.get(entry.sessionId) === ticket) {
        ticketOfSession.delete(entry.sessionId);
      }
    },
  };
}

/**
 * Preview tickets live in memory only, so they end when the app restarts. Each belongs to one
 * session, expires after a period of not being used, and is revoked when the session is archived.
 * A session has one ticket at a time, so the table never holds more than one per session.
 */
export function createPreviews(options: PreviewOptions = {}): Previews {
  const { lifetimeMs = HOUR_MS, now = Date.now } = options;
  const table = ticketTable();
  /** Looks a ticket up and counts it as used; an expired one is dropped. */
  const sessionOf = (ticket: string): SessionId | undefined => {
    const entry = table.entry(ticket);
    if (entry === undefined || now() >= entry.expiresAt) {
      table.drop(ticket);
      return undefined;
    }
    entry.expiresAt = now() + lifetimeMs;
    return entry.sessionId;
  };
  return {
    ticketFor: (sessionId) => {
      const current = table.ticketOf(sessionId);
      if (current !== undefined && sessionOf(current) !== undefined) return current;
      const ticket = newTicket();
      table.add(ticket, { sessionId, expiresAt: now() + lifetimeMs });
      return ticket;
    },
    sessionOf,
    revoke: table.drop,
  };
}
